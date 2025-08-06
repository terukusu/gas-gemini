// Gemini関連のパラメータのデフォルト値
const _DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const _DEFAULT_GEMINI_IMAGE_MODEL = "imagen-3.0-generate-001";
const _DEFAULT_MAX_TOKENS = 8192;
const _DEFAULT_TEMPERATURE = 1.0;
const _DEFAULT_TOP_P = 0.95;
const _DEFAULT_TOP_K = 40;
const _DEFAULT_MAX_RETRY = 5;
const _DEFAULT_CANDIDATE_COUNT = 1;

// 画像生成関連のデフォルトパラメータ  
const _DEFAULT_IMAGE_ASPECT_RATIO = "1:1";
const _DEFAULT_IMAGE_SAFETY_FILTER_LEVEL = "block_only_high";

// Gemini安全設定のデフォルト
const _DEFAULT_SAFETY_SETTINGS = [
  {
    "category": "HARM_CATEGORY_HARASSMENT",
    "threshold": "BLOCK_MEDIUM_AND_ABOVE"
  },
  {
    "category": "HARM_CATEGORY_HATE_SPEECH", 
    "threshold": "BLOCK_MEDIUM_AND_ABOVE"
  },
  {
    "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
    "threshold": "BLOCK_MEDIUM_AND_ABOVE"
  },
  {
    "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
    "threshold": "BLOCK_MEDIUM_AND_ABOVE"
  }
];

/**
 * Geminiクライアントオブジェクトを生成します。Google Gemini APIとの通信を管理するためのクライアントです。
 * このオブジェクトを通じて、Geminiのモデル（例えば、Gemini 2.5 Flash）を利用して
 * テキスト生成、画像分析、画像生成、エンベディングなどのAIに関連するタスクを実行することができます。
 *
 * 主な機能としては、プロンプトをAIに送信し、生成されたテキストやJSONスキーマに基づく
 * レスポンスを取得することができます。また、APIキー、モデルの種類、トークンの最大数、
 * 温度パラメータ、最大リトライ回数など、APIリクエストに関連する複数の設定をカスタマイズ可能です。
 *
 * 使用方法:
 * const client = createGeminiClient({
 *   apiKey: '<YOUR_API_KEY>'
 * });
 * const response = client.simpleChat("Hello, world!");
 * 
 * @param {Object} config - オブジェクトの構成オプションを含む設定オブジェクト。
 * @param {string} config.apiKey - APIキーの文字列。必須です。
 * @param {string} [config.model="gemini-2.5-flash"] - 使用するモデルの識別子。省略可能で、デフォルトは gemini-2.5-flash です。
 * @param {number} [config.maxTokens=10000] - トークンの最大数。省略可能で、デフォルトは 10000 です。
 * @param {number} [config.temperature=0.6] - モデルの温度パラメータ。省略可能で、デフォルトは 0.6 です。
 * @param {Blob[]} [config.images] - 画像です。Geminiのマルチモーダル機能で処理されます。
 * @param {Object} [config.responseSchema] - AIからの出力フォーマットを表すJSONスキーマ。
 * @param {Object[]} [config.functions] - AIが必要に応じて実行する関数のオプションのリスト。各オブジェクトは以下のプロパティを持つ:
 * @param {Function} config.functions[].func - 必要に応じて実行する関数。
 * @param {string} config.functions[].description - 関数の説明。
 * @param {Object} config.functions[].parameters - 関数の引数を定義するJSONスキーマ。
 * @param {number} [config.maxRetry=5] - 最大リトライ回数。省略可能で、デフォルトは5です。
 * @param {number} [config.maxRetryForFormatAiMessage=5] - responseSchema指定時にレスポンスJSON化の最大リトライ回数。省略可能で、デフォルトは5です。
 */
function createGeminiClient(config) {
  return new Gemini(config);
}

class Gemini {
  constructor(config) {
    // 設定オブジェクトの基本検証
    if (!config || typeof config !== 'object') {
      throw new Error('Configuration object is required');
    }

    // APIキーの検証
    if (!config.apiKey || typeof config.apiKey !== 'string' || config.apiKey.trim() === '') {
      throw new Error('Valid API key (non-empty string) is required');
    }

    // 基本パラメータ
    this.apiKey = config.apiKey.trim();
    this.model = config.model || _DEFAULT_GEMINI_MODEL;
    this.maxTokens = config.maxTokens || _DEFAULT_MAX_TOKENS;
    this.temperature = config.temperature !== undefined ? config.temperature : _DEFAULT_TEMPERATURE;
    this.responseSchema = config.responseSchema;
    this.maxRetry = config.maxRetry || _DEFAULT_MAX_RETRY;
    
    // Gemini独自パラメータ
    this.topP = config.topP !== undefined ? config.topP : _DEFAULT_TOP_P;
    this.topK = config.topK !== undefined ? config.topK : _DEFAULT_TOP_K;
    this.candidateCount = config.candidateCount || _DEFAULT_CANDIDATE_COUNT;
    this.safetySettings = config.safetySettings || _DEFAULT_SAFETY_SETTINGS;
    this.systemInstruction = config.systemInstruction;
    
    // その他のプロパティ
    this.images = config.images || [];
    this.maxRetryForFormatAiMessage = config.maxRetryForFormatAiMessage || _DEFAULT_MAX_RETRY;

    // 数値パラメータの検証
    this.validateNumericParam_('maxTokens', config.maxTokens, 1, 2097152);
    this.validateNumericParam_('temperature', config.temperature, 0, 2);
    this.validateNumericParam_('topP', config.topP, 0, 1);
    this.validateNumericParam_('topK', config.topK, 1, 100);
    this.validateNumericParam_('candidateCount', config.candidateCount, 1, 8);
    this.validateNumericParam_('maxRetry', config.maxRetry, 1, 20);

    // モデル名の検証
    if (config.model && typeof config.model !== 'string') {
      throw new Error('model must be a string');
    }

    // 安全設定の検証
    if (config.safetySettings && !Array.isArray(config.safetySettings)) {
      throw new Error('safetySettings must be an array');
    }
  }

  /**
   * 数値パラメータのバリデーション
   */
  validateNumericParam_(name, value, min, max) {
    if (value !== undefined) {
      if (typeof value !== 'number' || value < min || value > max) {
        throw new Error(`${name} must be a number between ${min} and ${max}`);
      }
    }
  }

  /**
   * AIにプロンプトを渡して文字列を生成させます。
   * params では今回の呼び出しにのみ適用されるパラメータを指定可能です。
   * 省略するとインスタンス化時に設定した値になります。
   * 
   * @param {string} prompt - 生成用のプロンプト
   * @param {Object} [params] - 生成オプションを含む設定オブジェクト。
   * @param {string} [params.model] - 使用するモデルの識別子。
   * @param {number} [params.maxTokens] - トークンの最大数。
   * @param {number} [params.temperature] - モデルの温度パラメータ。
   * @param {Blob[]} [params.images] - 画像です。Geminiのマルチモーダル機能で処理されます。
   * @param {Object} [params.responseSchema] - AIからの出力フォーマットを表すJSONスキーマ。
   * @param {Object[]} [params.functions] - AIが必要に応じて実行する関数のオプションのリスト。
   * @param {number} [params.maxRetry] - 最大リトライ回数。
   * @param {number} [params.maxRetryForFormatAiMessage=5] - responseSchema指定時にレスポンスJSON化の最大リトライ回数。
   * @return {Object|string} params.responseSchema を指定していればその型のオブジェクト、そうでなければテキスト
   * @throws {Error} Gemini APIレイヤでのエラーが発生した場合に例外をスローします。
   */
  simpleChat(prompt, params={}) {
    const result = this.generateContent(prompt, params);
    if (result.error) {
      throw new Error("API エラー: " + JSON.stringify(result.error));
    }

    // Function Callingの結果処理
    if (result.candidates && result.candidates[0] && result.candidates[0].content) {
      // partsが存在しない場合のエラーハンドリング
      if (!result.candidates[0].content.parts || result.candidates[0].content.parts.length === 0) {
        // finishReasonをチェック
        const finishReason = result.candidates[0].finishReason;
        if (finishReason === "MAX_TOKENS") {
          throw new Error("レスポンスがトークン上限に達しました。maxTokensを増やしてください。現在の設定: " + (params.maxTokens || this.maxTokens));
        } else if (finishReason === "SAFETY") {
          throw new Error("コンテンツが安全性フィルターによってブロックされました。");
        } else {
          throw new Error("予期しないレスポンス形式です: " + JSON.stringify(result));
        }
      }
      
      const parts = result.candidates[0].content.parts;
      
      // Function callがある場合の処理
      const functionCall = parts.find(part => part.functionCall);
      if (functionCall) {
        let resObj = null;
        const argJson = JSON.stringify(functionCall.functionCall.args);

        try {
          resObj = JSON.parse(argJson);
        } catch (e) {
          throw new Error("JSONパースに失敗しました。完全なJSONになっていない場合、params.maxTokensを増やしてみてください。: argJson=" + argJson + ", 元のError=" + e.toString());
        }

        return resObj;
      }
      
      // 通常のテキストレスポンス
      const textPart = parts.find(part => part.text);
      if (textPart) {
        return textPart.text;
      }
    }

    throw new Error("予期しないレスポンス形式です: " + JSON.stringify(result));
  }

  /**
   * AIにプロンプトを渡してコンテンツを生成させます。
   * params では今回の呼び出しにのみ適用されるパラメータを指定可能です。
   * 省略するとインスタンス化時に設定した値になります。
   * 
   * @param {string} prompt - 生成用のプロンプト
   * @param {Object} [params] - 生成オプションを含む設定オブジェクト。
   * @param {string} [params.model] - 使用するモデルの識別子。
   * @param {number} [params.maxTokens] - トークンの最大数。
   * @param {number} [params.temperature] - モデルの温度パラメータ（0-2）。
   * @param {number} [params.topP] - Top-p値（0-1）。
   * @param {number} [params.topK] - Top-k値（1-100）。
   * @param {number} [params.candidateCount] - 生成する候補数（1-8）。
   * @param {Object} [params.responseSchema] - AIからの出力フォーマットを表すJSONスキーマ。
   * @param {Object[]} [params.tools] - AIが必要に応じて実行するツールのリスト。
   * @param {Blob[]} [params.images] - 画像です。Geminiのマルチモーダル機能で処理されます。
   * @param {Blob[]} [params.videos] - 動画です。Geminiの動画分析機能で処理されます。
   * @param {Array} [params.safetySettings] - 安全設定の配列。
   * @param {string} [params.systemInstruction] - システム指示。
   * @param {number} [params.maxRetry] - 最大リトライ回数。
   * @return {Object} Gemini APIからのレスポンスJSONをパースしたオブジェクト
   */
  generateContent(prompt, params={}) {
    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt
            }
          ]
        }
      ]
    };

    // システム指示の設定
    const systemInstruction = params.systemInstruction || this.systemInstruction;
    if (systemInstruction) {
      payload.systemInstruction = {
        parts: [{ text: systemInstruction }]
      };
    }

    // 生成設定の構築
    const generationConfig = this.buildGenerationConfig_(params);
    if (Object.keys(generationConfig).length > 0) {
      payload.generationConfig = generationConfig;
    }

    // 安全設定
    const safetySettings = params.safetySettings || this.safetySettings;
    if (safetySettings && safetySettings.length > 0) {
      payload.safetySettings = safetySettings;
    }

    // Tool Use（Function Calling）の設定
    if (params.tools || params.functions) {
      // functionsパラメータは下位互換のため残す
      const tools = params.tools || params.functions;
      payload.tools = [{
        functionDeclarations: tools.map(tool => {
          // 新形式（tool.name, tool.description）または旧形式（tool.func.name）に対応
          return {
            name: tool.name || tool.func.name,
            description: tool.description,
            parameters: tool.parameters
          };
        })
      }];
    }

    // メディアファイル（画像・動画）の処理
    const mediaFiles = [];
    if (params.images) mediaFiles.push(...params.images);
    if (params.videos) mediaFiles.push(...params.videos);
    if (this.images) mediaFiles.push(...this.images);

    if (mediaFiles.length > 0) {
      mediaFiles.forEach(mediaBlob => {
        // メディアファイルの基本検証
        if (!mediaBlob || typeof mediaBlob.getContentType !== 'function') {
          throw new Error('Invalid media file: must be a valid Blob object');
        }

        const mimeType = mediaBlob.getContentType();
        if (!mimeType) {
          throw new Error('Media file must have a valid MIME type');
        }

        try {
          const mediaBytes = mediaBlob.getBytes();
          const mediaB64 = Utilities.base64Encode(mediaBytes);

          payload.contents[0].parts.push({
            inlineData: {
              mimeType: mimeType,
              data: mediaB64
            }
          });
        } catch (error) {
          throw new Error(`Failed to process media file: ${error.message}`);
        }
      });
    }

    const url = this.getGenerateContentUrl_(params);

    let retryForFormatAiMessage = 0;
    const maxRetryForFormatAiMessage = params.maxRetryForFormatAiMessage || this.maxRetryForFormatAiMessage;

    // レスポンススキーマの取得（ループ内で参照するため事前に取得）
    const responseSchema = params.responseSchema || this.responseSchema;

    // Function Callingの処理ループ（無限ループを防ぐため最大試行回数を設定）
    const MAX_FUNCTION_CALLS = 10;
    let functionCallCount = 0;
    
    while (functionCallCount < MAX_FUNCTION_CALLS) {
      const res = this.callApi_(url, payload, params.maxRetry);

      if (res.error != null) {
        return res;
      }

      // Function Callingがない場合
      if (!res.candidates || !res.candidates[0].content.parts) {
        if (responseSchema) {
          // 必要なresponseSchemaが適用されていない場合は再試行
          if (retryForFormatAiMessage < maxRetryForFormatAiMessage) {
            Logger.log("Response schema not applied. retrying...: retryCont=" + retryForFormatAiMessage);
            retryForFormatAiMessage++;
            continue;
          }

          throw new Error("responseSchema のリトライ最大回数に到達しましたが、適用されませんでした。");
        } else {
          // シンプルな応答
          return res;
        }
      }

      const parts = res.candidates[0].content.parts;
      const functionCall = parts.find(part => part.functionCall);

      if (!functionCall) {
        // Function callがない通常の応答
        return res;
      }

      functionCallCount++;
      
      // モデルの応答（function call含む）をcontentsに追加
      payload.contents.push({
        role: "model",
        parts: parts
      });
      
      // Tool callがある場合の処理
      const tools = params.tools || params.functions;
      const targetTool = tools.find(tool => {
        const toolName = tool.name || tool.func.name;
        return toolName === functionCall.functionCall.name;
      });
      
      if (!targetTool) {
        throw new Error("未知のツールが呼び出されました: " + functionCall.functionCall.name);
      }

      try {
        const funcArgs = functionCall.functionCall.args;
        // 新形式（tool.execute）または旧形式（tool.func）に対応
        const executeFunc = targetTool.execute || targetTool.func;
        const funcResult = executeFunc(funcArgs);
        const funcResultJson = JSON.stringify(funcResult);

        // Function callの結果を次のメッセージに追加
        payload.contents.push({
          role: "user",
          parts: [{
            functionResponse: {
              name: functionCall.functionCall.name,
              response: {
                result: funcResultJson
              }
            }
          }]
        });
      } catch (funcError) {
        // 関数実行エラーをAIに伝える
        payload.contents.push({
          role: "user",
          parts: [{
            functionResponse: {
              name: functionCall.functionCall.name,
              response: {
                error: `Function execution failed: ${funcError.message}`
              }
            }
          }]
        });
      }
    }
    
    // Function callが最大回数に達した場合
    throw new Error(`Function calling limit exceeded (${MAX_FUNCTION_CALLS} calls). Possible infinite loop detected.`);
  }

  /**
   * Web APIをコールします。
   * Content-Type が application/json のリクエストを行います。
   * HTTPステータス429(Too Many Requests)時に Retry-After ヘッダーで何秒後にアクセスすれば良いか指示された場合だけリトライします。
   *
   * @param {string} url - APIエンドポイントのURL。
   * @param {Object} payload - ペイロード。
   * @param {number} [maxRetry=this.maxRetry] - 最大リトライ回数。
   */
  callApi_(url, payload, maxRetry=this.maxRetry) {
    // セキュリティのためAPIキーを除去してログ出力
    const sanitizedUrl = url.replace(/key=[^&]+/g, 'key=***');
    const sanitizedPayload = this.sanitizePayloadForLogging_(payload);
    
    Logger.log(`accessing url: ${sanitizedUrl}`);
    Logger.log("payload: " + JSON.stringify(sanitizedPayload));

    const headers = this.getAuthorizationHeader_();

    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: headers,
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    return this.requestWithRetry_(url, options, maxRetry);
  }

  /**
   * ログ出力用にペイロードから機密情報を除去します
   */
  sanitizePayloadForLogging_(payload) {
    try {
      const sanitized = JSON.parse(JSON.stringify(payload));
      
      // 画像データを除去
      if (sanitized.contents) {
        sanitized.contents.forEach(content => {
          if (content.parts) {
            content.parts.forEach(part => {
              if (part.inlineData && part.inlineData.data) {
                part.inlineData.data = '[BASE64_DATA_REMOVED]';
              }
            });
          }
        });
      }
      
      // バッチエンベディングのテキストデータを制限
      if (sanitized.requests && Array.isArray(sanitized.requests)) {
        sanitized.requests = sanitized.requests.slice(0, 3).map(req => ({
          ...req,
          content: req.content ? {
            ...req.content,
            parts: req.content.parts ? req.content.parts.map(part => ({
              ...part,
              text: part.text ? part.text.substring(0, 100) + '...' : part.text
            })) : req.content.parts
          } : req.content
        }));
        if (payload.requests.length > 3) {
          sanitized.requests.push(`... and ${payload.requests.length - 3} more requests`);
        }
      }
      
      return sanitized;
    } catch (e) {
      return { error: 'Failed to sanitize payload for logging' };
    }
  }

  /**
   * リトライ制御しつつHTTPリクエストするメソッド
   */
  requestWithRetry_(url, options, maxRetry=this.maxRetry) {
    let lastError = null;
    
    for (let attempts = 0; attempts < maxRetry; attempts++) {
      let response = null;
      try {
        response = UrlFetchApp.fetch(url, options);

        const content = response.getContentText();
        Logger.log('contentText: ' + content.substring(0, 200) + '...'); // 長いレスポンスは省略

        // リトライ条件
        const httpStatus = response.getResponseCode();
        if (httpStatus == 429) {
          const headers = response.getHeaders();
          const retryAfter = this.getDictValue_('retry-after', headers) || this.getDictValue_('x-ratelimit-reset-tokens', headers);
          if (retryAfter && attempts < maxRetry - 1) {
            Logger.log(`Rate limit exceeded. Retry after ${retryAfter} seconds.`);
            Utilities.sleep(retryAfter * 1000);
            continue;
          }
        } else if (httpStatus != 200) {
          throw new Error(`APIエラー: status=${httpStatus}, message=${content}`);
        }

        const json = JSON.parse(content);
        return json;
      } catch (e) {
        lastError = e;
        const message = e.toString();
        Logger.log(`Attempt ${attempts + 1} failed: ${message}`);
        
        // 最後の試行でない場合、指数バックオフでリトライ
        if (attempts < maxRetry - 1) {
          const backoffDelay = Math.min(1000 * Math.pow(2, attempts), 30000);
          Utilities.sleep(backoffDelay);
        }
      }
    }

    // リトライが最大回数に達した
    throw new Error(`APIエラー: リトライが最大回数に達しました（${maxRetry}回）: ${lastError ? lastError.message : 'Unknown error'}`);
  }

  /**
   * 指定されたキーに対応する連想配列（オブジェクト）の値を大文字小文字を無視して取得します。
   * キーが存在しない場合、undefinedが返されます。
   * @param {string} key 検索するキー
   * @param {Object} dict 検索対象の連想配列（オブジェクト）
   * @return {any} 指定されたキーに対応する値、またはキーが存在しない場合はundefined
   */
  getDictValue_(key, dict) {
    const normalizedKey = key.toLowerCase();
    const foundKey = Object.keys(dict).find(dictKey => dictKey.toLowerCase() === normalizedKey);
    return foundKey ? dict[foundKey] : undefined;
  }

  /**
   * コンテンツ生成用のURLを取得します
   */
  getGenerateContentUrl_(params={}) {
    const model = params.model || this.model;
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  }

  /**
   * 画像を生成します。
   * Imagen4モデルを使用して画像を生成します。
   * 
   * @param {string} prompt - 画像生成用のプロンプト
   * @param {Object} [params] - 生成オプションを含む設定オブジェクト。
   * @param {string} [params.model] - 使用するモデルの識別子。
   * @param {number} [params.n] - 生成する画像の枚数（Geminiでは常に1）。
   * @param {string} [params.size] - 画像サイズ（Geminiでは aspectRatio で制御）。
   * @param {string} [params.quality] - 画質設定。
   * @param {string} [params.response_format] - レスポンスフォーマット。
   * @param {string} [params.style] - スタイル設定。
   * @return {string} 生成された画像のURL
   */
  simpleImageGeneration(prompt, params={}) {
    const result = this.imageGeneration(prompt, params);
    
    if (result.error) {
      throw new Error("API エラー: " + JSON.stringify(result.error));
    }

    // Geminiの画像生成レスポンスから画像URLを抽出
    if (result.candidates && result.candidates[0].content.parts) {
      const parts = result.candidates[0].content.parts;
      const imagePart = parts.find(part => part.inlineData);
      
      if (imagePart && imagePart.inlineData) {
        // base64データをdata URIとして返す
        const mimeType = imagePart.inlineData.mimeType || 'image/jpeg';
        const base64Data = imagePart.inlineData.data;
        return `data:${mimeType};base64,${base64Data}`;
      }
    }

    throw new Error("画像生成に失敗しました: " + JSON.stringify(result));
  }

  /**
   * 画像を生成します。
   * Imagen4モデルを使用した詳細な画像生成API。
   * 
   * @param {string} prompt - 画像生成用のプロンプト
   * @param {Object} [params] - 生成オプションを含む設定オブジェクト。
   * @param {string} [params.model] - 使用するモデルの識別子。
   * @param {string} [params.aspectRatio] - アスペクト比（"1:1", "9:16", "16:9"など）。
   * @param {number} [params.maxRetry] - 最大リトライ回数。
   * @return {Object} Gemini APIからのレスポンス全体
   */
  imageGeneration(prompt, params={}) {
    const payload = {
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ]
    };

    // 生成設定
    const generationConfig = {};
    
    // アスペクト比の設定（Gemini独自）
    if (params.aspectRatio) {
      generationConfig.aspectRatio = params.aspectRatio;
    }

    if (Object.keys(generationConfig).length > 0) {
      payload.generationConfig = generationConfig;
    }

    const url = this.getImageGenerationUrl_(params);
    return this.callApi_(url, payload, params.maxRetry);
  }

  /**
   * テキストのEmbedding（ベクトル表現）を取得します。
   * シンプルな結果だけを返します。
   *
   * @param {string|string[]} input - Embeddingを生成するためのテキスト（文字列または文字列の配列）
   * @param {Object} [params] - 生成オプションを含む設定オブジェクト
   * @param {string} [params.model] - 使用するモデルの識別子（例: "text-embedding-004"）
   * @param {string} [params.taskType] - タスクタイプ（RETRIEVAL_QUERY, RETRIEVAL_DOCUMENT, など）
   * @return {number[]|number[][]} 入力テキストごとのEmbedding（単一文字列の場合は単一配列、文字列配列の場合は配列の配列）
   * @throws {Error} Gemini APIレイヤでのエラーが発生した場合に例外をスローします。
   */
  simpleEmbedding(input, params={}) {
    const result = this.createEmbedding(input, params);
    if (result.error) {
      throw new Error("API エラー: " + JSON.stringify(result.error));
    }

    // 入力が単一文字列の場合は単一配列、文字列配列の場合は配列の配列を返す
    if (Array.isArray(input)) {
      // 配列の各要素に対応するembeddingを結果の順序通りに取得
      return result.embeddings.map(item => item.values);
    } else {
      // 単一文字列の場合は最初のembeddingのみを返す
      return result.embedding.values;
    }
  }

  /**
   * テキストのEmbedding（ベクトル表現）を取得します。
   * APIからのレスポンス全体を返します。
   *
   * @param {string|string[]} input - Embeddingを生成するためのテキスト（文字列または文字列の配列）
   * @param {Object} [params] - 生成オプションを含む設定オブジェクト
   * @param {string} [params.model] - 使用するモデルの識別子（例: "text-embedding-004"）
   * @param {string} [params.taskType] - タスクタイプ（RETRIEVAL_QUERY, RETRIEVAL_DOCUMENT, など）
   * @param {number} [params.maxRetry] - 最大リトライ回数
   * @return {Object} Gemini APIからのレスポンス全体（embedding, usage情報などを含む）
   * @throws {Error} Gemini APIレイヤでのエラーが発生した場合に例外をスローします。
   */
  createEmbedding(input, params={}) {
    const model = params.model || "text-embedding-004";
    
    if (Array.isArray(input)) {
      // バッチ処理：複数のテキストを一度にembedding
      const payload = {
        requests: input.map(text => ({
          model: `models/${model}`,
          content: {
            parts: [{
              text: text
            }]
          },
          taskType: params.taskType || "RETRIEVAL_DOCUMENT"
        }))
      };

      const url = this.getBatchEmbeddingUrl_(params);
      return this.callApi_(url, payload, params.maxRetry);
    } else {
      // 単一テキストのembedding
      const payload = {
        model: `models/${model}`,
        content: {
          parts: [{
            text: input
          }]
        },
        taskType: params.taskType || "RETRIEVAL_DOCUMENT"
      };

      const url = this.getEmbeddingUrl_(params);
      return this.callApi_(url, payload, params.maxRetry);
    }
  }

  /**
   * 動画を分析します。
   * Gemini独自の動画分析機能です。
   * 
   * @param {Blob} video - 動画ファイルのBlob
   * @param {string} prompt - 動画分析用のプロンプト
   * @param {Object} [params] - 分析オプションを含む設定オブジェクト
   * @return {string} 動画分析結果のテキスト
   */
  simpleVideoAnalysis(video, prompt, params={}) {
    const result = this.videoAnalysis(video, prompt, params);
    
    if (result.error) {
      throw new Error("API エラー: " + JSON.stringify(result.error));
    }

    if (result.candidates && result.candidates[0].content.parts) {
      const textPart = result.candidates[0].content.parts.find(part => part.text);
      if (textPart) {
        return textPart.text;
      }
    }

    throw new Error("動画分析に失敗しました: " + JSON.stringify(result));
  }

  /**
   * 動画を分析します。
   * Gemini独自の動画分析機能の詳細版。
   * 
   * @param {Blob} video - 動画ファイルのBlob
   * @param {string} prompt - 動画分析用のプロンプト
   * @param {Object} [params] - 分析オプションを含む設定オブジェクト
   * @return {Object} Gemini APIからのレスポンス全体
   */
  videoAnalysis(video, prompt, params={}) {
    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt
            },
            {
              inlineData: {
                mimeType: video.getContentType(),
                data: Utilities.base64Encode(video.getBytes())
              }
            }
          ]
        }
      ]
    };

    // 生成設定
    const generationConfig = {};
    const temperature = params.temperature || this.temperature;
    const maxTokens = params.maxTokens || this.maxTokens;
    
    if (temperature !== undefined) {
      generationConfig.temperature = temperature;
    }
    if (maxTokens !== undefined) {
      generationConfig.maxOutputTokens = maxTokens;
    }

    if (Object.keys(generationConfig).length > 0) {
      payload.generationConfig = generationConfig;
    }

    const url = this.getGenerateContentUrl_(params);
    return this.callApi_(url, payload, params.maxRetry);
  }

  /**
   * 画像生成用のURLを取得します
   */
  getImageGenerationUrl_(params={}) {
    const model = params.model || _DEFAULT_GEMINI_IMAGE_MODEL;
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  }

  /**
   * エンベディング用のURLを取得します
   */
  getEmbeddingUrl_(params={}) {
    const model = params.model || "text-embedding-004";
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent`;
  }

  /**
   * バッチエンベディング用のURLを取得します
   */
  getBatchEmbeddingUrl_(params={}) {
    return `https://generativelanguage.googleapis.com/v1beta/models:batchEmbedContents`;
  }

  /**
   * 生成設定を構築します
   */
  buildGenerationConfig_(params) {
    const config = {};
    
    // 基本パラメータ
    const temperature = params.temperature !== undefined ? params.temperature : this.temperature;
    const maxTokens = params.maxTokens !== undefined ? params.maxTokens : this.maxTokens;
    const topP = params.topP !== undefined ? params.topP : this.topP;
    const topK = params.topK !== undefined ? params.topK : this.topK;
    const candidateCount = params.candidateCount !== undefined ? params.candidateCount : this.candidateCount;
    
    if (temperature !== undefined) config.temperature = temperature;
    if (maxTokens !== undefined) config.maxOutputTokens = maxTokens;
    if (topP !== undefined) config.topP = topP;
    if (topK !== undefined) config.topK = topK;
    if (candidateCount !== undefined) config.candidateCount = candidateCount;

    // 構造化出力の設定
    const responseSchema = params.responseSchema || this.responseSchema;
    if (responseSchema) {
      config.responseMimeType = "application/json";
      config.responseSchema = this.sanitizeSchemaForGemini_(responseSchema);
    }
    
    return config;
  }

  /**
   * JSONスキーマをGemini API用にサニタイズします
   * GeminiはOpenAIと異なり、$schemaやadditionalPropertiesをサポートしていません
   */
  sanitizeSchemaForGemini_(schema) {
    if (!schema || typeof schema !== 'object') {
      return schema;
    }

    const sanitized = JSON.parse(JSON.stringify(schema));
    
    // Geminiでサポートされていないプロパティを除去
    const unsupportedProps = ['$schema', 'additionalProperties', '$id', '$ref', 'definitions'];
    
    const cleanSchema = (obj) => {
      if (Array.isArray(obj)) {
        return obj.map(cleanSchema);
      } else if (obj && typeof obj === 'object') {
        const cleaned = {};
        for (const [key, value] of Object.entries(obj)) {
          if (!unsupportedProps.includes(key)) {
            cleaned[key] = cleanSchema(value);
          }
        }
        return cleaned;
      }
      return obj;
    };
    
    return cleanSchema(sanitized);
  }

  /**
   * 認証ヘッダーを取得します
   */
  getAuthorizationHeader_() {
    return {
      'x-goog-api-key': this.apiKey
    };
  }
}