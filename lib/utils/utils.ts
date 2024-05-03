
export const sleeper = async (seconds: number) => {
  return new Promise<boolean>((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, seconds * 1000);
  })
}

export function onlyUnique<T>(value: T, index: number, array: T[]) {
  return array.indexOf(value) === index;
}

export function isHex(str) {
  const regexp = /^[0-9a-f]+$/;
  if (regexp.test(str)) {
    return true;
  }
  else {
    return false;
  }
}
