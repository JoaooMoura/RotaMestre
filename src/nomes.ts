function partesDoNome(nome: string) {
  return nome.trim().split(/\s+/).filter(Boolean);
}

function ehLetra(caractere: string) {
  return caractere.toLowerCase() !== caractere.toUpperCase();
}

export function primeiroNome(nome: string) {
  return partesDoNome(nome)[0] ?? '';
}

export function iniciais(nome: string) {
  const partes = partesDoNome(nome).filter(parte => ehLetra(parte[0]));
  if (partes.length === 0) {
    return '';
  }
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (primeira + ultima).toUpperCase();
}
