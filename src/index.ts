import decodeVideoFile from './decode'

document.getElementById('inputFile')!.addEventListener('change', (e) => {
  const file = (e.target as HTMLInputElement).files![0]

  decodeVideoFile(file)
})
