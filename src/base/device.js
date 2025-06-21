import adapter from 'webrtc-adapter';

export function GetAllMediaDevice(){
    return new Promise(function (resolve, reject) {
        if (typeof navigator.mediaDevices != 'object' || typeof navigator.mediaDevices.enumerateDevices != 'function') {
            reject('enumerateDevices() not supported.');
          } else {
            // List cameras and microphones.
            navigator.mediaDevices
              .enumerateDevices()
              .then((devices) => {
                resolve(devices);
              })
              .catch((err) => {
                reject(`${err.name}: ${err.message}`);
              });
          }
    });
}