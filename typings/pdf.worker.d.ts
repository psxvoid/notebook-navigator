// declare module 'pdfjs-dist/build/pdf.worker.mjs' {
//     class WorkerMessageHandler {};
//     export { WorkerMessageHandler };
// }
// declare module 'pdfjs-dist/build/pdf.worker.mjs' {
//     export = typeof string
// }
declare module 'pdfjs-dist/build/pdf.worker?worker&url' {
    export = typeof string
}

// declare module "pdfjs-dist/build/pdf.worker.entry" {
//     export = typeof string
// }