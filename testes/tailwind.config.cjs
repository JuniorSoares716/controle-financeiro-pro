/* O Tailwind do sistema vem por CDN e é configurado dentro do próprio HTML.
   Aqui ele é compilado com a MESMA paleta, para que o teste veja as mesmas
   cores e os mesmos espaçamentos que você vê no navegador. */
module.exports = {
  content: ['./testes/.tmp/app.html'],
  theme: {
    extend: {
      colors: { blue: { 50:'#ECFDF8',100:'#CFF8EC',200:'#9FEFDB',300:'#5EEAD4',400:'#2DD4BF',500:'#14B8A6',600:'#0D9488',700:'#0F766E',800:'#115E59',900:'#134E4A' } },
      fontFamily: { sans: ['Inter', 'sans-serif'], display: ['Inter', 'sans-serif'] }
    }
  }
};
