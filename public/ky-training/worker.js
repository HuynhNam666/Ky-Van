import {searchMove} from './engine.js';
self.onmessage=e=>{const {id,board,side,level}=e.data;try{self.postMessage({id,...searchMove(board,side,level)})}catch{self.postMessage({id,error:'Máy chưa tính được nước đi. Hãy thử lại.'})}};
