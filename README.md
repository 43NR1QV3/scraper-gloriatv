# Scraper de Imagens para Gloria.tv

Este script permite baixar automaticamente imagens de postagens do Gloria.tv, organizando-as em diretórios por URL.

## Instalação

### Pré-requisitos

- [Node.js](https://nodejs.org/) (versão 14 ou superior)
- [Yarn](https://yarnpkg.com/) ou NPM

### Configuração

1. Clone ou baixe este repositório para sua máquina
2. Abra um terminal na pasta do projeto
3. Instale as dependências usando Yarn:

```bash
yarn install
```

Ou, se preferir usar NPM:

```bash
npm install
```

## Dependências

O script utiliza as seguintes bibliotecas:

- **puppeteer**: Para automação do navegador e interação com a página
- **axios**: Para download das imagens
- **fs** e **path**: Módulos nativos do Node.js para manipulação de arquivos

## Como Usar

### Uso Básico

Para baixar imagens de uma ou mais URLs do Gloria.tv:

```bash
node index.js https://gloria.tv/post/URL1
```

Para múltiplas URLs, você pode separá-las por vírgula:

```bash
node index.js https://gloria.tv/post/URL1,https://gloria.tv/post/URL2
```

Ou passar cada URL como um argumento separado:

```bash
node index.js https://gloria.tv/post/URL1 https://gloria.tv/post/URL2
```

### Opções Disponíveis

O script oferece algumas opções para controlar seu comportamento:

- **--overwrite**: Força a sobrescrita de imagens existentes

  ```bash
  node index.js --overwrite https://gloria.tv/post/URL1
  ```

- **--skip-existing-dirs**: Pula completamente URLs cujos diretórios já existem
  ```bash
  node index.js --skip-existing-dirs https://gloria.tv/post/URL1
  ```

## Estrutura de Arquivos

As imagens são salvas na seguinte estrutura:

```
output/
  ├── [slug-da-url-1]/
  │   ├── 0001-imagem1.jpg
  │   ├── 0002-imagem2.jpg
  │   └── ...
  └── [slug-da-url-2]/
      ├── 0001-imagem1.svg
      ├── 0002-imagem2.svg
      └── ...
```

Onde `[slug-da-url]` é o identificador extraído da URL do Gloria.tv (a parte após `/post/`).

## Funcionalidades

- Extrai automaticamente o slug da URL para criar diretórios organizados
- Baixa imagens do penúltimo e último div.page em cada página
- Navega automaticamente entre as páginas usando o botão "próxima"
- Evita baixar a mesma imagem duas vezes
- Continua a numeração a partir do último arquivo se o diretório já existir
- Exibe um resumo ao final do processamento

## Solução de Problemas

### O script não encontra as imagens

Verifique se a estrutura da página do Gloria.tv segue o padrão esperado. O script procura por imagens dentro de:

```
body > div.frame > div.leading > div.page
```

### Erro de navegação entre páginas

Se o script não conseguir navegar entre as páginas, pode ser devido a mudanças na estrutura do site. O script procura por um botão dentro de:

```
body > div.frame > div.nav-next
```

### Problemas com puppeteer

Em alguns sistemas, o puppeteer pode exigir dependências adicionais. Consulte a [documentação oficial do puppeteer](https://pptr.dev/) para mais informações.

## Contribuições

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues ou enviar pull requests com melhorias.

---

Espero que este script seja útil para baixar e organizar suas imagens do Gloria.tv!
