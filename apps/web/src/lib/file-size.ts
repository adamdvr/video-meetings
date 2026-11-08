const SIZE_UNITS = ['Б', 'КБ', 'МБ', 'ГБ'];
const sizeFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });

export function formatFileSize(bytes: number) {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < SIZE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${sizeFormat.format(value)} ${SIZE_UNITS[unit]}`;
}
