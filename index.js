const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, EmbedBuilder, StringSelectMenuBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const fs = require('fs'); // Para trabalhar com arquivos JSON

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

let produtos = {}; // Armazenar produtos em memória

// Função para salvar os produtos no arquivo JSON
function saveProdutos() {
  fs.writeFileSync('produtos.json', JSON.stringify(produtos, null, 2), 'utf-8');
}

// Função para carregar os produtos do arquivo JSON
function loadProdutos() {
  try {
    const data = fs.readFileSync('produtos.json', 'utf-8');
    produtos = JSON.parse(data);
  } catch (error) {
    console.error('Erro ao carregar os produtos:', error);
  }
}

// Carregar os produtos ao iniciar o bot
loadProdutos();

// Função para gerar a embed de um produto
function generateProductEmbed(produto) {
  return new EmbedBuilder()
    .setColor('#0099FF')
    .setTitle(produto.title)
    .setDescription(produto.description)
    .addFields(
      { name: 'Preço', value: `${produto.price} ${produto.currency}`, inline: true },
      { name: 'Estoque', value: `Keys disponíveis: ${produto.stock.length}`, inline: true }
    );
}

client.once('ready', () => {
  console.log('Bot está online!');
});

client.on('messageCreate', async (message) => {
  if (message.content === '!Loja') {
    await message.delete();

    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder().setCustomId('addProduct').setLabel('Adicionar Produto').setStyle('Primary'),
        new ButtonBuilder().setCustomId('editProduct').setLabel('Editar Produto').setStyle('Success'),
        new ButtonBuilder().setCustomId('deleteProduct').setLabel('Excluir Produto').setStyle('Danger')
      );

    const botMessage = await message.channel.send({
      content: 'Bem-vindo à loja! Escolha o que você deseja fazer:',
      components: [row1]
    });

    setTimeout(() => botMessage.delete(), 5000);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;
  await interaction.deferUpdate();

  // Lógica para adicionar um produto
  if (interaction.customId === 'addProduct') {
    const nameMessage = await interaction.followUp('Digite o nome do produto:');

    const nameCollector = interaction.channel.createMessageCollector({ max: 1, time: 60000 });
    nameCollector.on('collect', async (nameMessageUser) => {
      const title = nameMessageUser.content;
      await nameMessageUser.delete();
      await nameMessage.delete();

      const priceMessage = await interaction.followUp('Digite o preço do produto:');

      const priceCollector = interaction.channel.createMessageCollector({ max: 1, time: 60000 });
      priceCollector.on('collect', async (priceMessageUser) => {
        const price = priceMessageUser.content;
        await priceMessageUser.delete();
        await priceMessage.delete();

        const descMessage = await interaction.followUp('Digite a descrição do produto:');

        const descCollector = interaction.channel.createMessageCollector({ max: 1, time: 60000 });
        descCollector.on('collect', async (descMessageUser) => {
          const description = descMessageUser.content;
          await descMessageUser.delete();
          await descMessage.delete();

          const stockMessage = await interaction.followUp('Digite as keys do produto (separadas por ponto e vírgula):');

          const stockCollector = interaction.channel.createMessageCollector({ max: 1, time: 60000 });
          stockCollector.on('collect', async (stockMessageUser) => {
            const stock = stockMessageUser.content.split(';').map(key => key.trim());
            await stockMessageUser.delete();
            await stockMessage.delete();

            // Adicionando o produto ao armazenamento
            produtos[title] = {
              title,
              price,
              description,
              stock,
              currency: 'BRL'
            };

            // Salvar os produtos no arquivo
            saveProdutos();

            // Agora, pedimos ao usuário para escolher o canal onde o produto será postado
            const channelMessage = await interaction.followUp('Digite o ID do canal onde você deseja que o produto seja postado (ex: 1134821511375626290):');

            const channelCollector = interaction.channel.createMessageCollector({ max: 1, time: 60000 });
            channelCollector.on('collect', async (channelMessageUser) => {
              const channelId = channelMessageUser.content.trim();

              try {
                // Verifique se o canal existe
                const channel = await interaction.guild.channels.fetch(channelId);

                // Verifique se o canal é do tipo correto (TextChannel)
                if (channel && channel.type === ChannelType.GuildText) {
                  // Botão de compra
                  const buyButton = new ButtonBuilder()
                    .setCustomId('buyProduct')
                    .setLabel('Comprar')
                    .setStyle('Primary');

                  const row = new ActionRowBuilder().addComponents(buyButton);

                  // Enviar o embed para o canal escolhido
                  await channel.send({
                    content: `Produto **${title}** adicionado com sucesso!`,
                    embeds: [generateProductEmbed(produtos[title])],
                    components: [row]
                  });

                  await interaction.followUp('Produto adicionado e anunciado com sucesso no canal escolhido!');
                } else {
                  await interaction.followUp('O canal informado não é válido. Tente novamente com um ID de canal válido.');
                }
              } catch (error) {
                console.error(error);
                await interaction.followUp('Não foi possível encontrar o canal com o ID fornecido. Tente novamente.');
              }

              await channelMessageUser.delete();
              await channelMessage.delete();
            });
          });
        });
      });
    });
  }

  // Lógica para editar produto
  if (interaction.customId === 'editProduct') {
    console.log('Edit Product button clicked'); // Log para depuração

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('selectProductToEdit')
      .setPlaceholder('Selecione um produto para editar')
      .addOptions(
        Object.keys(produtos).map(title => ({ label: title, value: title }))
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);
    await interaction.followUp({
      content: 'Selecione o produto que você deseja editar:',
      components: [row]
    });
  }

  // Lógica para selecionar o produto para editar
  if (interaction.customId === 'selectProductToEdit') {
    const selectedProductTitle = interaction.values[0]; // Corrigido para acessar o título do produto selecionado corretamente
    const produto = produtos[selectedProductTitle]; // Verificando se o produto existe

    if (!produto) {
      return interaction.followUp('Produto não encontrado.');
    }

    const editOptionsMenu = new StringSelectMenuBuilder()
      .setCustomId('editProductOptions')
      .setPlaceholder('Escolha o campo a ser editado')
      .addOptions([
        { label: 'Editar Preço', value: 'price' },
        { label: 'Editar Descrição', value: 'description' },
        { label: 'Editar Estoque', value: 'stock' }
      ]);

    const row = new ActionRowBuilder().addComponents(editOptionsMenu);
    await interaction.followUp({
      content: `Você selecionou o produto: **${produto.title}**. O que você deseja editar?`,
      components: [row]
    });
  }

  const fs = require('fs');  // Importando fs para salvar no arquivo JSON

  // Função para salvar o JSON atualizado
  function saveProdutosToFile(produtos) {
    fs.writeFileSync('produtos.json', JSON.stringify(produtos, null, 2), 'utf-8');
  }

  // Lógica para editar o preço, descrição ou estoque do produto
  if (interaction.customId === 'editProductOptions') {
    const selectedOption = interaction.values[0]; // A opção selecionada para editar (preço, descrição ou estoque)

    // Solicitar o link da mensagem ao usuário
    const linkPromptMsg = await interaction.followUp('Por favor, envie o link da mensagem onde o produto foi postado.');

    const linkCollector = interaction.channel.createMessageCollector({ max: 1, time: 60000 });
    linkCollector.on('collect', async (linkMessage) => {
      const messageLink = linkMessage.content.trim();

      // Extrair o ID do canal e da mensagem a partir do link fornecido
      const urlParts = messageLink.split('/');
      const channelId = urlParts[5];  // O ID do canal está na posição 5
      const messageId = urlParts[6];  // O ID da mensagem está na posição 6

      try {
        // Buscar o canal usando o ID extraído
        const channel = await interaction.guild.channels.fetch(channelId);

        // Buscar a mensagem usando o ID extraído
        const targetMessage = await channel.messages.fetch(messageId);

        if (!targetMessage.embeds || targetMessage.embeds.length === 0) {
          return interaction.followUp('A mensagem fornecida não contém uma embed válida de produto.');
        }

        const selectedProductTitle = targetMessage.embeds[0].title; // Acessando o título do produto diretamente da embed
        const produto = produtos[selectedProductTitle]; // Verificando se o produto existe

        if (!produto) {
          return interaction.followUp('Produto não encontrado.');
        }

        console.log('Produto encontrado:', produto); // Log de depuração para verificar se o produto é encontrado corretamente

        // Iniciando a edição conforme a opção selecionada
        if (selectedOption === 'price') {
          const newPriceMessage = await interaction.followUp('Digite o novo preço do produto:');
          const newPriceCollector = interaction.channel.createMessageCollector({ max: 1, time: 60000 });
          newPriceCollector.on('collect', async (priceMessageUser) => {
            const newPrice = priceMessageUser.content.trim();
            if (isNaN(newPrice)) {
              return interaction.followUp('Por favor, insira um preço válido.');
            }

            produto.price = newPrice; // Atualizando o produto no JSON
            produtos[selectedProductTitle] = produto; // Garantindo que o objeto 'produtos' também seja atualizado

            console.log('Preço atualizado no JSON:', produto.price); // Log de depuração para garantir que o preço foi alterado

            saveProdutosToFile(produtos);  // Salvar no arquivo JSON

            await priceMessageUser.delete();  // Apagar a resposta do usuário

            // Atualizar a embed
            const updatedEmbed = generateProductEmbed(produto);
            await targetMessage.edit({ embeds: [updatedEmbed] });

            await interaction.followUp('Preço atualizado com sucesso!');
          });
        } else if (selectedOption === 'description') {
          const newDescMessage = await interaction.followUp('Digite a nova descrição do produto:');
          const newDescCollector = interaction.channel.createMessageCollector({ max: 1, time: 60000 });
          newDescCollector.on('collect', async (descMessageUser) => {
            const newDescription = descMessageUser.content.trim();
            produto.description = newDescription; // Atualizando o produto no JSON
            produtos[selectedProductTitle] = produto; // Garantindo que o objeto 'produtos' também seja atualizado

            console.log('Descrição atualizada no JSON:', produto.description); // Log de depuração para garantir que a descrição foi alterada

            saveProdutosToFile(produtos);  // Salvar no arquivo JSON

            await descMessageUser.delete();  // Apagar a resposta do usuário

            // Atualizar a embed
            const updatedEmbed = generateProductEmbed(produto);
            await targetMessage.edit({ embeds: [updatedEmbed] });

            await interaction.followUp('Descrição atualizada com sucesso!');
          });
        } else if (selectedOption === 'stock') {
          const newStockMessage = await interaction.followUp('Digite as novas keys (separadas por ponto e vírgula):');
          const newStockCollector = interaction.channel.createMessageCollector({ max: 1, time: 60000 });
          newStockCollector.on('collect', async (stockMessageUser) => {
            const newStock = stockMessageUser.content.split(';').map(key => key.trim());
            produto.stock = newStock; // Atualizando o produto no JSON
            produtos[selectedProductTitle] = produto; // Garantindo que o objeto 'produtos' também seja atualizado

            console.log('Estoque atualizado no JSON:', produto.stock); // Log de depuração para garantir que o estoque foi alterado

            saveProdutosToFile(produtos);  // Salvar no arquivo JSON

            await stockMessageUser.delete();  // Apagar a resposta do usuário

            // Atualizar a embed
            const updatedEmbed = generateProductEmbed(produto);
            await targetMessage.edit({ embeds: [updatedEmbed] });

            await interaction.followUp('Estoque atualizado com sucesso!');
          });
        }
      } catch (error) {
        console.error(error);
        await interaction.followUp('Erro ao tentar buscar a mensagem com o link fornecido.');
      }

      await linkMessage.delete();  // Apagar a resposta do usuário
    });
  }

  // Lógica para excluir um produto
  if (interaction.customId === 'deleteProduct') {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('selectProductToDelete')
      .setPlaceholder('Selecione um produto para excluir')
      .addOptions(
        Object.keys(produtos).map(title => ({ label: title, value: title }))
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);
    await interaction.followUp({
      content: 'Selecione o produto que você deseja excluir:',
      components: [row]
    });
  }

  // Lógica para excluir produto
  if (interaction.customId === 'selectProductToDelete') {
    const selectedProductTitle = interaction.values[0];

    if (produtos[selectedProductTitle]) {
      delete produtos[selectedProductTitle];
      saveProdutos();
      await interaction.followUp(`Produto ${selectedProductTitle} excluído com sucesso.`);
    } else {
      await interaction.followUp('Produto não encontrado.');
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
