// Formatação do nome do usuário para exibição (saudação e avatar).

function partesDoNome(nome: string) {
  return nome.trim().split(/\s+/).filter(Boolean);
}

// Letra é o que tem maiúscula e minúscula diferentes (vale para acentos, sem regex Unicode).
function ehLetra(caractere: string) {
  return caractere.toLowerCase() !== caractere.toUpperCase();
}

export function primeiroNome(nome: string) {
  return partesDoNome(nome)[0] ?? '';
}

// Só palavras que começam com letra contam: "Carlos Mendes (Demo)" vira "CM".
export function iniciais(nome: string) {
  const partes = partesDoNome(nome).filter(parte => ehLetra(parte[0]));
  if (partes.length === 0) {
    return '';
  }
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (primeira + ultima).toUpperCase();
}
