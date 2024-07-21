function get(key: string) {
  return localStorage.getItem(key);
}

function set(key: string, value: string) {
  localStorage.setItem(key, value);
}

function remove(key: string) {
  localStorage.removeItem(key);
}

export default { get, set, remove };
