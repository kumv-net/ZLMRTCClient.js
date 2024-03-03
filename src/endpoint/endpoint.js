
import { setLogger } from '../ulity/debug';
import * as debug from '../ulity/debug';
import Event from '../ulity/event';
import Events from '../base/event';
import axios from 'axios';
import * as Base from '../base/export';
import adapter from 'webrtc-adapter';

export default class RTCEndpoint extends Event
{
    constructor(options)
    {
        super('RTCPusherPlayer');
        const that = this;
        that.TAG = '[RTCPusherPlayer]';

        let defaults = {
            element: '',// html video element
            debug: false,// if output debug log
            zlmsdpUrl:'',
            simulcast:false,
            useCamera:true,
            audioEnable:true,
            videoEnable:true,
            recvOnly:false,
            resolution:{w:0,h:0},
            usedatachannel:false,
        };
        
        that.options = Object.assign({}, defaults, options);

        if(that.options.debug)
        {
            setLogger();
        }

        that.event = {
            onicecandidate:that._onIceCandidate.bind(that),
            ontrack:that._onTrack.bind(that),
            onicecandidateerror:that._onIceCandidateError.bind(that),
            onconnectionstatechange:that._onconnectionstatechange.bind(that),
            ondatachannelopen:that._onDataChannelOpen.bind(that),
            ondatachannelmsg:that._onDataChannelMsg.bind(that),
            ondatachannelerr:that._onDataChannelErr.bind(that),
            ondatachannelclose:that._onDataChannelClose.bind(that),
        };

        that._remoteStream = null;
        that._localStream = null;

        that._tracks = [];
        const {browser,version } = adapter.browserDetails;
        debug.log(this.TAG,'browserDetails:',browser,version);
        try {
            if (browser === 'chrome' && version < 72) {
                // 其他兼容性处理...
                const configuration = { sdpSemantics: 'unified-plan' };
            that.pc = new RTCPeerConnection(configuration);
              }else{
                that.pc = new RTCPeerConnection(null);
              }
        } catch (error) {
            window.__webrtc.emitData({type:'new RTCPeerConnection error',error:JSON.stringify(error),errorCode:error?.code,errorMSg:error?.message,typeof: typeof RTCPeerConnection});
            that.pc = new RTCPeerConnection();
        }

        that.pc.onicecandidate = that.event.onicecandidate;
        that.pc.onicecandidateerror = that.event.onicecandidateerror;
        that.pc.ontrack = that.event.ontrack;
        that.pc.onconnectionstatechange = that.event.onconnectionstatechange;

        that.datachannel = null;
        if(that.options.usedatachannel){
            that.datachannel = that.pc.createDataChannel('chat');
            that.datachannel.onclose = that.event.ondatachannelclose;
            that.datachannel.onerror = that.event.ondatachannelerr;
            that.datachannel.onmessage = that.event.ondatachannelmsg;
            that.datachannel.onopen = that.event.ondatachannelopen;
        }

        if(!that.options.recvOnly && (that.options.audioEnable || that.options.videoEnable))
            that.start();
        else
            that.receive();
            
    }

    receive()
    {
        let audioTransceiver = null;
        let videoTransceiver = null;
        const that = this;
        //debug.error(this.TAG,'this not implement');
        const  AudioTransceiverInit = {
            direction: 'recvonly',
            sendEncodings:[]
          };
        const VideoTransceiverInit= {
            direction: 'recvonly',
            sendEncodings:[],
          };
          const offerOptions={};
          debug.log(that.TAG,'addTransceiver:',that.pc?.addTransceiver);
      if (that.options.videoEnable) {
                if (typeof that.pc.addTransceiver === 'function') {
                    that.pc.addTransceiver('video', VideoTransceiverInit);
                }else{
            offerOptions.offerToReceiveVideo = true;
        }
      }
        if (that.options.audioEnable) {
                if (typeof that.pc.addTransceiver === 'function') {
                    that.pc.addTransceiver('audio', AudioTransceiverInit);
                }else{
            offerOptions.offerToReceiveAudio = true;
        }
      }
      debugger
      that.pc.createOffer(offerOptions).then((desc)=>{
            debug.log(that.TAG,'offer:',desc.sdp);
            that.pc.setLocalDescription(desc).then(() => {
                
                let data ;
                let headers ={
                    'Content-Type':'text/plain;charset=utf-8'
                };
                if(that.options?.qcloudLiveData){
                    /**
                     * {
    "streamurl": "webrtc://v.kdcw.kumv.net/live/44010200491110000001_44010200491310000001?txSecret=7311adfdb545dd6cad6b46ce9552243e&txTime=65E5DE07",
    "sessionid": "66kUIk3hl05cEy8YoC-Sb",
    "clientinfo": "Windows NT 10.0;Chrome 120.0.0.0",
    "localsdp": {
        "type": "offer",
        "sdp": ""
    }
}
                     */
                    data = that.options?.qcloudLiveData;
                    data.localsdp={
                        "type": "offer",
                        "sdp":desc.sdp
                        };
                        headers['Content-Type'] = 'application/json';
                }else{
                    data = desc.sdp;
                }
                axios({
                    method: 'post',
                    url:that.options.zlmsdpUrl,
                    responseType:'json',
                    data:data,
                    headers
                }).then(response=>{
                    let ret =  response.data;//JSON.parse(response.data);
                    if(ret?.remotesdp?.sdp){
                        ret.code = 0;
                        ret.sdp=ret?.remotesdp?.sdp
                    }
                    if(ret.code != 0)
                    {// mean failed for offer/anwser exchange 
                        this.dispatch(Events.WEBRTC_OFFER_ANWSER_EXCHANGE_FAILED,ret);
                        return;
                    }
                    let anwser = {};
                    anwser.sdp = ret.sdp;
                    anwser.type = 'answer';
                    debug.log(this.TAG,'answer:',ret.sdp);

                    this.pc.setRemoteDescription(anwser).then(()=>{
                        debug.log(this.TAG,'set remote sucess');
                    }).catch(e=>{
                        debug.error(this.TAG,e);
                    });
                })
            });
        }).catch(e=>{
            debug.error(this.TAG,e);
        });
    }

    start()
    {
        const that =this;
        let videoConstraints = false;
        let audioConstraints = false;

        if(that.options.useCamera)
        {
            if(that.options.videoEnable)
                videoConstraints = new Base.VideoTrackConstraints(Base.VideoSourceInfo.CAMERA);
            if(that.options.audioEnable)
                audioConstraints = new Base.AudioTrackConstraints(Base.AudioSourceInfo.MIC);
        }
        else
        {
            if(that.options.videoEnable)
            {
                videoConstraints = new Base.VideoTrackConstraints(Base.VideoSourceInfo.SCREENCAST);
                if(that.options.audioEnable)
                    audioConstraints = new Base.AudioTrackConstraints(Base.AudioSourceInfo.SCREENCAST);
            }
            else
            {
                if(that.options.audioEnable)
                    audioConstraints = new Base.AudioTrackConstraints(Base.AudioSourceInfo.MIC);
                else
                {// error shared display media not only audio
                    debug.error(that.TAG,'error paramter');
                }
            }
            
        }

        if(that.options.resolution.w !=0 && that.options.resolution.h!=0 && typeof videoConstraints == 'object'){
            videoConstraints.resolution = new Base.Resolution(that.options.resolution.w ,that.options.resolution.h);
        }

        Base.MediaStreamFactory.createMediaStream(new Base.StreamConstraints(
            audioConstraints, videoConstraints)).then(stream => {

                that._localStream = stream;

                that.dispatch(Events.WEBRTC_ON_LOCAL_STREAM,stream);

                const  AudioTransceiverInit = {
                    direction: 'sendrecv',
                    sendEncodings:[]
                  };
                const VideoTransceiverInit= {
                    direction: 'sendrecv',
                    sendEncodings:[],
                  };
                
                if(that.options.simulcast && stream.getVideoTracks().length>0)
                {
                    VideoTransceiverInit.sendEncodings = [
                        { rid: 'h', active: true, maxBitrate: 1000000 },
                        { rid: 'm', active: true, maxBitrate: 500000, scaleResolutionDownBy: 2 },
                        { rid: 'l', active: true, maxBitrate: 200000, scaleResolutionDownBy: 4 }
                    ];
                }
                let audioTransceiver = null;
                let videoTransceiver = null;
                const offerOptions={};
                if (that.options.audioEnable) {
                    
				if (typeof that.pc.addTransceiver === 'function') {
                    if (stream.getAudioTracks().length > 0) {
                        audioTransceiver = that.pc.addTransceiver(stream.getAudioTracks()[0],
                            AudioTransceiverInit);
                    }
                    else {
                        AudioTransceiverInit.direction = 'recvonly';
                        audioTransceiver = that.pc.addTransceiver('audio', AudioTransceiverInit);
                    }
                    }
                    offerOptions.offerToReceiveAudio = true;
                }
                
                if (that.options.videoEnable) {
                    if (typeof that.pc.addTransceiver === 'function') {
                    if (stream.getVideoTracks().length > 0) {
                        videoTransceiver = that.pc.addTransceiver(stream.getVideoTracks()[0],
                            VideoTransceiverInit);
                    }
                    else {
                        VideoTransceiverInit.direction = 'recvonly';
                        videoTransceiver = that.pc.addTransceiver('video',
                            VideoTransceiverInit);
                    }
                    }
                        offerOptions.offerToReceiveVideo = true;
                    
                }

                /*
                stream.getTracks().forEach((track,idx)=>{
                    debug.log(that.TAG,track);
                    that.pc.addTrack(track);
                });
                */
                that.pc.createOffer(offerOptions).then((desc)=>{
                    debug.log(that.TAG,'offer:',desc.sdp);
                    that.pc.setLocalDescription(desc).then(() => {
                        axios({
                            method: 'post',
                            url:that.options.zlmsdpUrl,
                            timeout:30000,
                            responseType:'json',
                            data:desc.sdp,
                            headers:{
                                'Content-Type':'text/plain;charset=utf-8'
                            }
                        }).then(response=>{
                            let ret =  response.data;//JSON.parse(response.data);
                            if(ret.code != 0)
                            {// mean failed for offer/anwser exchange 
                                that.dispatch(Events.WEBRTC_OFFER_ANWSER_EXCHANGE_FAILED,ret);
                                return;
                            }
                            let anwser = {};
                            anwser.sdp = ret.sdp;
                            anwser.type = 'answer';
                            debug.log(that.TAG,'answer:',ret.sdp);
        
                            that.pc.setRemoteDescription(anwser).then(()=>{
                                debug.log(that.TAG,'set remote sucess');
                            }).catch(e=>{
                                debug.error(that.TAG,e);
                            });
                        })
                    }).catch(e=>{
                        that.dispatch(Events.WEBRTC_OFFER_ANWSER_EXCHANGE_FAILED, ret);
                    });
                })

            }).catch(e=>{
                that.dispatch(Events.CAPTURE_STREAM_FAILED);
                //debug.error(that.TAG,e);
            });
        
        //const offerOptions = {};
        /*
        if (typeof this.pc.addTransceiver === 'function') {
            // |direction| seems not working on Safari.
            this.pc.addTransceiver('audio', { direction: 'recvonly' });
            this.pc.addTransceiver('video', { direction: 'recvonly' });
        } else {
            offerOptions.offerToReceiveAudio = true;
            offerOptions.offerToReceiveVideo = true;
        }
        */



    }
    _onIceCandidate(event) {
        if (event.candidate) {    
            debug.log(this.TAG,'Remote ICE candidate: \n ' + event.candidate.candidate);
            // Send the candidate to the remote peer
        }
        else {
            // All ICE candidates have been sent
        }
    }

    _onTrack(event){
        debug.log(this.TAG,'_onTrack kind',event);
        this._tracks.push(event.track);
        if(this.options.element && event.streams && event.streams.length>0)
        {	     
            if("srcObject" in this.options.element){
                // reset srcObject to work around minor bugs in Chrome and Edge.
                //this.options.element.srcObject = null;
                 this.options.element.srcObject = event.streams[0];
            }else{
                this.options.element.src = window.URL.createObjectURL(event.streams[0]);
            }
            this._remoteStream = event.streams[0];

            this.dispatch(Events.WEBRTC_ON_REMOTE_STREAMS,event);
        }
        else
        {
            if(this.pc.getReceivers().length ==this._tracks.length){
                debug.log(this.TAG,'play remote stream ');
                this._remoteStream = new MediaStream(this._tracks);
                if("srcObject" in this.options.element){
                    // reset srcObject to work around minor bugs in Chrome and Edge.
                    //this.options.element.srcObject = null;
                    this.options.element.srcObject = this._remoteStream;
                }else{
                    const mediaSource =  this._remoteStream instanceof MediaSource ? this._remoteStream : new MediaSource(this._remoteStream);
                    this.options.element.src = window.URL.createObjectURL(mediaSource);
                }
            }else{
                debug.error(this.TAG,'wait stream track finish');
            }
        }
    }

    _onIceCandidateError(event){
        this.dispatch(Events.WEBRTC_ICE_CANDIDATE_ERROR,event);
    }

    _onconnectionstatechange(event) {
        this.dispatch(Events.WEBRTC_ON_CONNECTION_STATE_CHANGE, this.pc?.connectionState);
    }

    _onDataChannelOpen(event) {
        debug.log(this.TAG,'ondatachannel open:',event);
        this.dispatch(Events.WEBRTC_ON_DATA_CHANNEL_OPEN,event);
    }
    _onDataChannelMsg(event) {
        debug.log(this.TAG,'ondatachannel msg:',event);
        this.dispatch(Events.WEBRTC_ON_DATA_CHANNEL_MSG,event);
    }
    _onDataChannelErr(event){
        debug.log(this.TAG,'ondatachannel err:',event);
        this.dispatch(Events.WEBRTC_ON_DATA_CHANNEL_ERR,event);
    }
    _onDataChannelClose(event){
        debug.log(this.TAG,'ondatachannel close:',event);
        this.dispatch(Events.WEBRTC_ON_DATA_CHANNEL_CLOSE,event);
    }
    sendMsg(data){
        if(this.datachannel !=null){
            this.datachannel.send(data);
        }else{
            debug.error(this.TAG,'data channel is null');
        }
    }
    closeDataChannel(){
        if(this.datachannel){
            this.datachannel.close();
            this.datachannel = null;
        }
    }
    close()
    {  
        this.closeDataChannel();
        if(this.pc)
        {
            this.pc.close();
            this.pc=null;
        }

        if(this.options)
        {
            this.options=null;
        }

        if(this._localStream)
        {
            this._localStream.getTracks().forEach((track,idx)=>{
                track.stop();
            });
        }

        if(this._remoteStream)
        {
            this._remoteStream.getTracks().forEach((track,idx)=>{
                track.stop();
            });
        }

        this._tracks.forEach((track, idx) => {
          track.stop();
        });
        this._tracks = [];
    }

    get remoteStream()
    {
        return this._remoteStream;
    }
    
    get localStream()
    {
        return this._localStream;
    }
}
