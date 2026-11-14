// Validação e normalização dos dados enviados pelo formulário.
// O servidor nunca confia no que chega do navegador: tudo é revalidado aqui.

export const onlyDigits = (value) => String(value ?? '').replace(/\D/g, '')

export function isValidCpf(value) {
  const cpf = onlyDigits(value)
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  const digit = (length) => {
    let sum = 0
    for (let i = 0; i < length; i++) sum += Number(cpf[i]) * (length + 1 - i)
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10])
}

function text(value, max) {
  return String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

/**
 * Normaliza um passageiro e registra os erros em `errors` (chave = "prefixo.campo").
 * Retorna sempre um objeto limpo; quem chama decide o que fazer se houver erros.
 */
export function parsePassenger(raw, prefix, errors) {
  const data = raw && typeof raw === 'object' ? raw : {}
  const fail = (field, message) => {
    errors[`${prefix}.${field}`] = message
  }

  const nome = text(data.nome, 120)
  if (nome.split(' ').filter((part) => part.length > 1).length < 2) fail('nome', 'Informe o nome completo.')

  const cpf = onlyDigits(data.cpf)
  if (!isValidCpf(cpf)) fail('cpf', 'CPF inválido.')

  const emergenciaNome = text(data.emergenciaNome, 120)
  if (emergenciaNome.length < 2) fail('emergenciaNome', 'Informe o nome do contato de emergência.')

  const emergenciaTelefone = onlyDigits(data.emergenciaTelefone).slice(0, 11)
  if (emergenciaTelefone.length < 10) fail('emergenciaTelefone', 'Informe um telefone com DDD.')

  const temAlergia = data.temAlergia === true
  const alergias = temAlergia ? text(data.alergias, 600) : ''
  if (typeof data.temAlergia !== 'boolean') fail('temAlergia', 'Selecione uma opção.')
  else if (temAlergia && !alergias) fail('alergias', 'Conta pra gente quais são as alergias.')

  const temNecessidade = data.temNecessidade === true
  const necessidade = temNecessidade ? text(data.necessidade, 600) : ''
  if (typeof data.temNecessidade !== 'boolean') fail('temNecessidade', 'Selecione uma opção.')
  else if (temNecessidade && !necessidade) fail('necessidade', 'Descreva a necessidade e o suporte desejado.')

  return {
    nome,
    cpf,
    emergenciaNome,
    emergenciaTelefone,
    hospital: text(data.hospital, 160),
    convenio: text(data.convenio, 160),
    temAlergia,
    alergias,
    temNecessidade,
    necessidade,
  }
}

/** "Ana Paula de Souza" -> "Ana S." — é só isso que o mapa público mostra. */
export function publicName(nome) {
  const parts = String(nome).trim().split(/\s+/)
  const first = parts[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1] : ''
  return last ? `${first} ${last[0].toUpperCase()}.` : first
}
