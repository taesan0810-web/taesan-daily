import {pipeline,env} from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';

env.allowLocalModels=false;
env.backends.onnx.wasm.numThreads=1;
let transcriber;
self.onmessage=async({data})=>{
 try{
  transcriber??=await pipeline('automatic-speech-recognition','onnx-community/whisper-tiny_timestamped',{
   revision:'517244293732ee2d58139af5814231b7e6830a0d',dtype:'q8',device:'wasm',progress_callback:event=>{
    if(event.status==='progress')self.postMessage({type:'progress',message:'下载模型 '+Math.round(event.progress||0)+'% · '+(event.file||'')});
   }
  });
  self.postMessage({type:'progress',message:'正在识别人声与时间点，请保持页面打开…'});
  const result=await transcriber(data.audio,{language:data.language,task:'transcribe',return_timestamps:'word',chunk_length_s:30,stride_length_s:5});
  self.postMessage({type:'result',chunks:result.chunks||[]});
 }catch(error){self.postMessage({type:'error',message:error.message});}
};
