// Dublê mínimo: o teste só exercita funções puras, nunca toca no Firebase.
module.exports = { initializeApp: () => {}, credential: { cert: () => ({}) }, firestore: () => ({}), apps: [] };
