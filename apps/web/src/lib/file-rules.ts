export const MAX_FILE_SIZE = 1024 ** 3;

export const FILE_FORMATS = [
  'MP4',
  'WebM',
  'MOV',
  'MP3',
  'M4A',
  'WAV',
  'OGG',
  'PDF',
  'DOCX',
  'PPTX',
  'XLSX',
  'TXT',
  'PNG',
  'JPG',
  'WebP',
  'GIF',
];

const EXTENSIONS = new Set([
  ...FILE_FORMATS.map((format) => `.${format.toLowerCase()}`),
  '.jpeg',
]);

function extensionOf(fileName: string) {
  const name = fileName.normalize('NFC').trim();
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot).toLowerCase() : '';
}

export function rejectionOf(file: { name: string; size: number }) {
  if (file.size === 0) return 'Файл пустой';
  if (file.size > MAX_FILE_SIZE) return 'Файл больше 1 ГБ';
  if (!EXTENSIONS.has(extensionOf(file.name)))
    return 'Формат не поддерживается';
  return null;
}

export function uploadErrorOf(status: number, message?: unknown) {
  switch (status) {
    case 0:
      return 'Связь прервалась';
    case 400:
      return message === 'File is empty'
        ? 'Файл пустой'
        : 'Не удалось загрузить';
    case 401:
      return 'Сессия истекла, войдите снова';
    case 404:
      return 'Встреча не найдена';
    case 413:
      return 'Файл больше 1 ГБ';
    case 415:
      return message === 'File content does not match its format'
        ? 'Содержимое не соответствует формату'
        : 'Формат не поддерживается';
    case 502:
      return 'Сервер недоступен';
    default:
      return 'Не удалось загрузить';
  }
}

export enum ViewKind {
  Video = 'video',
  Audio = 'audio',
  Image = 'image',
  Pdf = 'pdf',
}

export function viewKindOf(mimeType: string) {
  if (mimeType === 'application/pdf') return ViewKind.Pdf;
  if (mimeType.startsWith('video/')) return ViewKind.Video;
  if (mimeType.startsWith('audio/')) return ViewKind.Audio;
  if (mimeType.startsWith('image/')) return ViewKind.Image;
  return null;
}
