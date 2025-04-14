const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

/**
 * Cria um diretório se ele não existir
 * @param {string} dirPath - Caminho do diretório
 */
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Extrai o slug da URL do gloria.tv
 * @param {string} url - URL completa
 * @returns {string} - Slug extraído
 */
function extractSlug(url) {
  const match = url.match(/\/post\/([^\/\?]+)/);
  return match ? match[1] : "unknown-" + Date.now();
}

/**
 * Faz o download de uma imagem a partir de uma URL
 * @param {string} url - URL da imagem
 * @param {string} filename - Caminho completo onde a imagem será salva
 * @returns {Promise<boolean>} - Sucesso ou falha do download
 */
async function downloadImage(url, filename) {
  try {
    const response = await axios({
      url,
      method: "GET",
      responseType: "stream",
    });

    const writer = fs.createWriteStream(filename);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", () => resolve(true));
      writer.on("error", reject);
    });
  } catch (error) {
    console.error(`Erro ao baixar a imagem ${url}:`, error);
    return false;
  }
}

/**
 * Faz scraping das imagens de uma URL do gloria.tv
 * @param {string} url - URL da página do gloria.tv
 * @param {string} outputDir - Diretório base para salvar as imagens
 */
async function scrapeImages(url, outputDir) {
  // Extrair o slug da URL e criar o diretório específico
  const slug = extractSlug(url);
  const slugDir = path.join(outputDir, slug);
  ensureDirectoryExists(slugDir);
  
  console.log(`\n===== Processando ${url} =====`);
  console.log(`Salvando imagens em: ${slugDir}`);
  
  const browser = await puppeteer.launch({
    headless: "new",
    defaultViewport: { width: 1280, height: 900 },
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1280,900"],
  });

  try {
    const page = await browser.newPage();

    // Adicionar logs no console do navegador para depuração
    page.on("console", (msg) => console.log("BROWSER LOG:", msg.text()));

    // Navegar para a página inicial
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    console.log("Página inicial carregada com sucesso");

    // Aguardar um pouco para garantir que tudo está carregado
    await new Promise((resolve) => setTimeout(resolve, 2000));

    let imageCounter = 1;
    let currentPage = 1;
    let hasMorePages = true;

    // Continuar enquanto houver mais páginas
    while (hasMorePages) {
      console.log(`Processando página ${currentPage}...`);

      // Extrair e baixar as imagens da página atual
      const pageData = await page.evaluate(() => {
        // Vamos usar seletores diretos conforme a estrutura informada
        const frameDiv = document.querySelector('body > div.frame');
        if (!frameDiv) return { error: "Div com class 'frame' não encontrada" };

        // Encontrar a div.leading diretamente dentro de frameDiv
        const leadingDiv = frameDiv.querySelector('div.leading');
        if (!leadingDiv) {
          const divs = Array.from(frameDiv.querySelectorAll('div')).map(d => d.className);
          return { 
            error: "Div com class 'leading' não encontrada", 
            classes: divs 
          };
        }

        const pagesDivs = leadingDiv.querySelectorAll('div.page');
        if (!pagesDivs || pagesDivs.length < 2) {
          return { 
            error: `Não foram encontrados pelo menos 2 divs com class 'page' (encontrados: ${pagesDivs?.length || 0})`,
            structure: Array.from(pagesDivs || []).map(div => div.innerHTML.substring(0, 100))
          };
        }

        // Pegar as imagens do penúltimo e último div.page
        const penultimateDiv = pagesDivs[pagesDivs.length - 2];
        const lastDiv = pagesDivs[pagesDivs.length - 1];

        const penultimateImg = penultimateDiv.querySelector('img');
        const lastImg = lastDiv.querySelector('img');

        // Verificar se o botão de próxima página existe
        const nextButtonContainer = document.querySelector('body > div.frame div.nav-next');
        const nextButton = nextButtonContainer ? 
                          (nextButtonContainer.querySelector('button') || 
                           nextButtonContainer.querySelector('a')) : 
                          null;
        
        const hasNext = !!nextButton && !nextButtonContainer.classList.contains('disabled');

        return {
          images: [
            penultimateImg ? penultimateImg.src : null,
            lastImg ? lastImg.src : null
          ].filter(Boolean),
          hasNextPage: hasNext
        };
      });

      // Verificar se houve erro na estrutura
      if (pageData.error) {
        console.error(`Erro na estrutura da página ${currentPage}:`, pageData.error);
        if (pageData.classes) {
          console.log("Classes encontradas em div.frame:", pageData.classes);
        }
        if (pageData.structure) {
          console.log("Estrutura encontrada:", pageData.structure);
        }
        break;
      }

      // Baixar as imagens encontradas
      console.log(`Encontradas ${pageData.images.length} imagens na página ${currentPage}`);
      for (const imageUrl of pageData.images) {
        // Extrair nome do arquivo da URL
        const fileName = path.basename(imageUrl).split("?")[0];
        
        // Criar nome do arquivo com prefixo formatado
        const paddedCounter = String(imageCounter).padStart(4, "0");
        const outputPath = path.join(slugDir, `${paddedCounter}-${fileName}`);
        
        console.log(`Baixando imagem ${imageCounter} da página ${currentPage}: ${imageUrl}`);
        const success = await downloadImage(imageUrl, outputPath);
        
        if (success) {
          console.log(`Imagem ${imageCounter} baixada com sucesso`);
          imageCounter++;
        } else {
          console.log(`Falha ao baixar a imagem ${imageCounter}`);
        }
      }

      // Verificar se há próxima página
      if (pageData.hasNextPage) {
        console.log("Clicando no botão de próxima página...");
        
        // Identificar e clicar no elemento de navegação
        const clickResult = await page.evaluate(() => {
          // Tentar encontrar elementos clicáveis na div.nav-next
          const navNext = document.querySelector('body > div.frame div.nav-next');
          if (!navNext) return { success: false, error: "div.nav-next não encontrada" };
          
         // Tentar botão primeiro
         const button = navNext.querySelector('button');
         if (button) {
           button.click();
           return { success: true, elementType: 'button' };
         }
         
         // Tentar link
         const link = navNext.querySelector('a');
         if (link) {
           link.click();
           return { success: true, elementType: 'a' };
         }
         
         // Se não tiver elementos internos, tentar a própria div
         if (navNext.onclick || navNext.addEventListener) {
           navNext.click();
           return { success: true, elementType: 'div' };
         }
         
         return { 
           success: false, 
           error: "Nenhum elemento clicável encontrado",
           html: navNext.outerHTML
         };
       });
       
       console.log("Resultado do clique:", clickResult);
       
       if (clickResult.success) {
         // Aguardar a atualização do conteúdo após o clique
         console.log("Aguardando atualização do conteúdo...");
         
         // Esperar um tempo para o conteúdo ser atualizado via AJAX
         await new Promise(resolve => setTimeout(resolve, 3000));
         
         // Verificar se o conteúdo foi atualizado comparando as imagens atuais
         const contentChanged = await page.evaluate((previousImages) => {
           const leadingDiv = document.querySelector('body > div.frame div.leading');
           if (!leadingDiv) return false;
           
           const pagesDivs = leadingDiv.querySelectorAll('div.page');
           if (!pagesDivs || pagesDivs.length < 2) return false;
           
           const penultimateDiv = pagesDivs[pagesDivs.length - 2];
           const lastDiv = pagesDivs[pagesDivs.length - 1];
           
           const penultimateImg = penultimateDiv.querySelector('img');
           const lastImg = lastDiv.querySelector('img');
           
           const currentImages = [
             penultimateImg ? penultimateImg.src : null,
             lastImg ? lastImg.src : null
           ].filter(Boolean);
           
           // Verificar se as imagens são diferentes das anteriores
           if (currentImages.length === 0) return false;
           
           if (previousImages.length !== currentImages.length) return true;
           
           for (let i = 0; i < currentImages.length; i++) {
             if (previousImages[i] !== currentImages[i]) return true;
           }
           
           return false;
         }, pageData.images);
         
         if (contentChanged) {
           console.log("Conteúdo atualizado com sucesso!");
           currentPage++;
         } else {
           console.log("O conteúdo não parece ter sido atualizado após o clique");
           
           // Tentar uma segunda vez com mais tempo de espera
           await new Promise(resolve => setTimeout(resolve, 5000));
           
           // Verificar novamente se o conteúdo foi atualizado
           const secondCheck = await page.evaluate((previousImages) => {
             const leadingDiv = document.querySelector('body > div.frame div.leading');
             if (!leadingDiv) return { changed: false, error: "div.leading não encontrada" };
             
             const pagesDivs = leadingDiv.querySelectorAll('div.page');
             if (!pagesDivs || pagesDivs.length < 2) {
               return { 
                 changed: false, 
                 error: "Menos de 2 divs.page encontradas", 
                 count: pagesDivs?.length || 0 
               };
             }
             
             const penultimateDiv = pagesDivs[pagesDivs.length - 2];
             const lastDiv = pagesDivs[pagesDivs.length - 1];
             
             const penultimateImg = penultimateDiv.querySelector('img');
             const lastImg = lastDiv.querySelector('img');
             
             const currentImages = [
               penultimateImg ? penultimateImg.src : null,
               lastImg ? lastImg.src : null
             ].filter(Boolean);
             
             return {
               changed: JSON.stringify(previousImages) !== JSON.stringify(currentImages),
               newImages: currentImages,
               oldImages: previousImages
             };
           }, pageData.images);
           
           console.log("Resultado da segunda verificação:", secondCheck);
           
           if (secondCheck.changed) {
             console.log("Conteúdo atualizado após espera adicional!");
             currentPage++;
           } else {
             console.log("Não foi possível atualizar o conteúdo, encerrando o loop");
             hasMorePages = false;
           }
         }
       } else {
         console.log("Não foi possível clicar no botão de próxima página:", clickResult.error);
         if (clickResult.html) {
           console.log("HTML do elemento de navegação:", clickResult.html);
         }
         hasMorePages = false;
       }
     } else {
       console.log("Não há mais páginas para processar");
       hasMorePages = false;
     }
   }

   console.log(`Scraping de ${url} concluído! Total de ${imageCounter - 1} imagens baixadas em ${slugDir}`);
   return imageCounter - 1;

 } catch (error) {
   console.error(`Erro durante o scraping de ${url}:`, error);
   return 0;
 } finally {
   await browser.close();
 }
}

/**
* Função principal para processar múltiplos URLs
*/
async function processUrls(urls) {
 // Diretório base para salvar as imagens
 const baseOutputDir = path.join(__dirname, "output");
 ensureDirectoryExists(baseOutputDir);
 
 console.log(`Iniciando processamento de ${urls.length} URLs`);
 
 let totalImages = 0;
 let successUrls = 0;
 
 // Processar cada URL sequencialmente
 for (let i = 0; i < urls.length; i++) {
   const url = urls[i];
   console.log(`\nProcessando URL ${i+1}/${urls.length}: ${url}`);
   
   try {
     const imagesDownloaded = await scrapeImages(url, baseOutputDir);
     if (imagesDownloaded > 0) {
       successUrls++;
       totalImages += imagesDownloaded;
     }
   } catch (error) {
     console.error(`Erro ao processar URL ${url}:`, error);
   }
 }
 
 console.log(`\n===== RESUMO =====`);
 console.log(`Total de URLs processadas com sucesso: ${successUrls}/${urls.length}`);
 console.log(`Total de imagens baixadas: ${totalImages}`);
 console.log(`Diretório base: ${baseOutputDir}`);
}

// Verificar argumentos da linha de comando
if (process.argv.length < 3) {
 console.log("Uso: node scraper.js URL1,URL2,URL3...");
 console.log("Ou: node scraper.js URL1 URL2 URL3...");
 process.exit(1);
}

// Obter URLs dos argumentos
let urls = [];

// Verificar se as URLs estão separadas por vírgula no primeiro argumento
if (process.argv[2].includes(',')) {
 urls = process.argv[2].split(',').map(url => url.trim());
} else {
 // Caso contrário, considerar cada argumento como uma URL separada
 urls = process.argv.slice(2).map(url => url.trim());
}

// Filtrar URLs vazias
urls = urls.filter(url => url && url.startsWith('http'));

if (urls.length === 0) {
 console.log("Nenhuma URL válida fornecida");
 process.exit(1);
}

if (urls.length === 0) {
  console.log("Nenhuma URL válida fornecida");
  process.exit(1);
}

// Iniciar o processamento
processUrls(urls);