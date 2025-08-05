# gas-gemini 詳細設計書

## プロジェクト概要

Google Apps Script（GAS）用のGoogle Gemini AIクライアントライブラリ。既存のgas-openaiライブラリと同等のインターフェースを提供し、Gemini APIの機能をGAS環境で簡単に利用できるようにする。

## 設計方針

1. **シンプルな設計**: 継承なしの単一クラス構造
2. **インターフェース統一**: OpenAI版と同等のメソッド名とパラメータ
3. **機能充実**: Geminiの全主要機能をカバー
4. **エラーハンドリング**: 自動リトライ機能とレート制限対応

## 機能対応表

| 機能 | OpenAI版 | Gemini版 | 実装状況 |
|------|----------|----------|----------|
| テキスト生成 | ✅ simpleChat | ✅ simpleChat | 設計済み |
| JSON出力 | ✅ responseSchema | ✅ responseSchema | 設計済み |
| 画像分析 | ✅ Vision | ✅ Vision | 設計済み |
| 画像生成 | ✅ DALL-E | ✅ Imagen4 | 設計済み |
| 音声文字起こし | ✅ Whisper | ❌ 非対応 | - |
| Function Calling | ✅ あり | ✅ Tool Use | 設計済み |
| エンベディング | ✅ あり | ✅ あり | 設計済み |
| 動画分析 | ❌ 非対応 | ✅ Veo | 設計済み |

## クラス設計

### Gemini クラス

```javascript
class Gemini {
  constructor(config)
  
  // === メイン機能 ===
  simpleChat(prompt, params={})           // シンプルなチャット生成
  generateContent(prompt, params={})      // 詳細なコンテンツ生成API
  
  // === 画像関連 ===
  simpleImageGeneration(prompt, params={}) // 画像生成（シンプル）
  imageGeneration(prompt, params={})       // 画像生成（詳細）
  
  // === 新機能（Gemini独自） ===
  simpleVideoAnalysis(video, params={})    // 動画分析（シンプル）
  videoAnalysis(video, params={})          // 動画分析（詳細）
  
  // === エンベディング ===
  simpleEmbedding(input, params={})       // エンベディング（シンプル）
  createEmbedding(input, params={})       // エンベディング（詳細）
  
  // === ユーティリティ ===
  callApi_(url, payload, maxRetry)        // API呼び出し
  requestWithRetry_(url, options, maxRetry) // リトライ付きリクエスト
  toCamelCase_(str)                       // キャメルケース変換
  getDictValue_(key, dict)                // 辞書検索
  
  // === URL生成 ===
  getGenerateContentUrl_(params)          // コンテンツ生成URL
  getImageGenerationUrl_(params)          // 画像生成URL
  getEmbeddingUrl_(params)                // エンベディングURL
  getAuthorizationHeader_()               // 認証ヘッダー
}
```

## ファクトリ関数

```javascript
function createGeminiClient(config) {
  return new Gemini(config);
}
```

## 設定定数

### Gemini関連デフォルト値
```javascript
const _DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
const _DEFAULT_GEMINI_IMAGE_MODEL = "imagen-4"
const _DEFAULT_MAX_TOKENS = 10000
const _DEFAULT_TEMPERATURE = 0.6
const _DEFAULT_MAX_RETRY = 5
const _DEFAULT_MAX_RETRY_FOR_FORMAT_AI_MESSAGE = 5

// 画像生成関連
const _DEFAULT_IMAGE_N = 1
const _DEFAULT_IMAGE_SIZE = "1024x1024"
const _DEFAULT_IMAGE_QUALITY = "standard"
const _DEFAULT_IMAGE_RESPONSE_FORMAT = "url"
```

## API エンドポイント設計

### 1. テキスト生成
- **URL**: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- **認証**: API Key (`key={apiKey}`)
- **メソッド**: POST

### 2. 画像生成
- **URL**: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- **認証**: API Key (`key={apiKey}`)
- **メソッド**: POST

### 3. エンベディング
- **URL**: `https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent`
- **認証**: API Key (`key={apiKey}`)
- **メソッド**: POST

## リクエスト・レスポンス形式

### テキスト生成リクエスト
```javascript
{
  "contents": [{
    "parts": [{
      "text": "プロンプトテキスト"
    }]
  }],
  "generationConfig": {
    "temperature": 0.6,
    "maxOutputTokens": 10000,
    "responseMimeType": "application/json", // JSON出力時
    "responseSchema": {...} // JSON出力時
  },
  "tools": [...] // Function Calling時
}
```

### 画像分析リクエスト
```javascript
{
  "contents": [{
    "parts": [
      {
        "text": "この画像を説明してください"
      },
      {
        "inlineData": {
          "mimeType": "image/jpeg",
          "data": "base64エンコードされた画像データ"
        }
      }
    ]
  }]
}
```

### Function Calling設計
```javascript
{
  "tools": [{
    "functionDeclarations": [{
      "name": "関数名",
      "description": "関数の説明",
      "parameters": {
        "type": "object",
        "properties": {...},
        "required": [...]
      }
    }]
  }]
}
```

## エラーハンドリング設計

### リトライ対象エラー
- HTTP 429 (Too Many Requests)
- HTTP 500 (Internal Server Error)
- HTTP 503 (Service Unavailable)

### リトライ戦略
- 指数バックオフ（1秒、2秒、4秒、8秒、16秒）
- `maxRetry`回数まで自動リトライ
- `Retry-After`ヘッダーがあれば従う

## パラメータ対応表

### simpleChat パラメータ
| パラメータ | OpenAI | Gemini | 説明 |
|-----------|--------|--------|------|
| model | model | model | 使用モデル |
| maxTokens | max_tokens | maxOutputTokens | 最大トークン数 |
| temperature | temperature | temperature | 温度パラメータ |
| images | images | inlineData | 画像入力 |
| responseSchema | responseSchema | responseSchema | JSON出力スキーマ |
| functions | functions | tools | Function Calling |

### 画像生成パラメータ
| パラメータ | OpenAI | Gemini | 説明 |
|-----------|--------|--------|------|
| model | dall-e-3 | imagen-4 | 画像生成モデル |
| n | n | (固定1) | 生成画像数 |
| size | size | aspectRatio | 画像サイズ |
| quality | quality | - | 画質設定 |

## 使用例

### 基本的なテキスト生成
```javascript
const client = createGeminiClient({
  apiKey: 'YOUR_API_KEY'
});

const response = client.simpleChat("こんにちは!");
```

### JSON出力
```javascript
const responseSchema = {
  "type": "object",
  "properties": {
    "name": {"type": "string"},
    "age": {"type": "number"}
  }
};

const response = client.simpleChat("架空の人物を作って", {
  responseSchema: responseSchema
});
```

### 画像分析
```javascript
const image = DriveApp.getFileById("IMAGE_ID");
const response = client.simpleChat("この画像を説明して", {
  images: [image.getBlob()]
});
```

### 画像生成
```javascript
const imageUrl = client.simpleImageGeneration("犬の絵を描いて", {
  model: "imagen-4"
});
```

## セキュリティ考慮事項

1. **APIキー管理**: PropertiesServiceでの安全な保存
2. **HTTPS通信**: 全てのAPI通信はHTTPS
3. **レート制限遵守**: 自動リトライでAPI制限を回避
4. **エラーログ**: センシティブ情報を含まないログ出力

## 今後の拡張予定

1. **ストリーミング対応**: リアルタイム生成機能
2. **ファイルAPI対応**: 大きなファイルのアップロード
3. **コンテキストキャッシュ**: 長い会話の効率化
4. **モデル調整**: カスタムモデルの対応

## 実装優先順位

1. **Phase 1**: 基本的なテキスト生成（simpleChat, generateContent）
2. **Phase 2**: 画像分析機能（Vision相当）
3. **Phase 3**: JSON出力とFunction Calling
4. **Phase 4**: 画像生成機能
5. **Phase 5**: エンベディング機能
6. **Phase 6**: 動画分析機能（Gemini独自）