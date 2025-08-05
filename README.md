# gas-gemini
- GAS(Google Apps Script)から使えるGoogle Geminiクライアントライブラリです。

## 特徴
- 超シンプルなインターフェイス
- 流量制限時の自動リトライ対応
- テキストを生成・・OK！
- JSON出力・・OK！
- 画像分析・・OK！
- 画像生成・・OK！（Imagen4）
- **動画分析・・OK！**（Gemini独自機能）
- 関数呼び出しによる前提知識補完・・OK！
- エンベディング・・・OK！
- Google Gemini API に対応
- デフォルトでも動くけど、パラメータで柔軟にカスタマイズも可能(モデル名とか)

# 使い方
- [src/Gemini.js](src/Gemini.js) の内容を何処かのGASへ保存
- 使いたいGASへライブラリとして追加する
    - スクリプトエディタの左メニューの「ライブラリ ＋」の ＋ をクリックして、↑のスクリプトIDを指定
- 詳しい使い方は、[src/Gemini.js](src/Gemini.js) や↓のサンプルを斜め読みしてください

# シンプルなコードの例
```JavaScript
// Geminiの場合
const client = createGeminiClient({
  apiKey: '<YOUR_API_KEY>'
});

const response = client.simpleChat("こんにちは!");
```

# AIの回答をJSONで受け取る例
```JavaScript
  // ==== AIの回答をJSONで受け取る例 ====
  const responseSchemaHuman = {
    "title": "Human",
    "type": "object",
    "properties": {
      "name": {
        "type": "string",
        "description": "名前"
      },
      "age": {
        "type": "number",
        "description": "年齢"
      }
    },
    "required": ["name", "age"]
  };
  
  params = {
    responseSchema: responseSchemaHuman
  }

  result = client.simpleChat("架空の人物になって自己紹介をして", params);
  Logger.log(result);
  // 出力例：
  // {
  //   "name": "ヴィクトリア",
  //   "age": 27
  // }
  //
```

JSONスキーマは、受け取りたいJSONっぽい雰囲気のものを書いて、以下のようにChatGPTにJSONスキーマにしてもらえばOK。  

# AIの前提知識を関数呼び出しで補完する例
```JavaScript
  // ==== AIに利用可能な関数を伝えて、必要に応じて実行させる例(Function Calling機能) ====
  function getWeather(args) {
    return {weather: "晴れ", location: args.location};
  }
  
  const functions = [{
    func: getWeather,
    description: "指定された地域の天気を調べます。",
    parameters: {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "properties": {
        "location": {
          "type": "string",
          "description": "天気を調べたい地域"
        }
      },
      "required": ["location"],
      "additionalProperties": false
    }
  }];
  
  params = {
    functions: functions,
  }
  
  result = client.simpleChat("アラスカの天気は？", params);
  Logger.log(result);
  // 出力例：
  // アラスカの天気は晴れです。
  //
```

# 画像をAIで処理する例
```JavaScript
  // ==== Drive上の画像を処理する例 ====
  const myPng  = DriveApp.getFileById("1KRr_7CdjYklHwSvL7EfRfp0EiStgxTIq");

  params = {
    model: "gemini-2.5-flash", // 画像が使えるモデルを選ぶ
    images:[myPng.getBlob()]
  };

  result = client.simpleChat("この画像を解説してください。", params);
  Logger.log(result);
  // 出力例：
  // この画像は、スマートフォンやタブレットなどのデバイスで使用されるメニューの一部を示しています。画面の左側には、各メニュー項目のアイコンが表示されており、右側にはその項目の名前が書かれています。
  //
```

# AIで画像を生成する例
```JavaScript
  params = {
    model: "imagen-4", // 画像生成を使うときはこのモデルを指定
    aspectRatio: "1:1" // アスペクト比を指定（Gemini独自）
  };

  result = client.simpleImageGeneration("犬を描いてください。", params);
  Logger.log(result);
  // 出力例：
  // data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...
  // (生成された画像のbase64データURIが出力される）
  //
```

# 動画をAIで分析する例（Gemini独自機能）
```JavaScript
  // ==== Drive上の動画を分析する例 ====
  const myVideo = DriveApp.getFileById("1nPivg4JwHhrE4Qax1du2CM2P5uIIY9Py");

  params = {
    model: "gemini-2.5-flash" // 動画分析対応モデル
  };

  result = client.simpleVideoAnalysis(myVideo.getBlob(), "この動画で何が起こっていますか？", params);
  Logger.log(result);
  // 出力例：
  // この動画では、公園で子供たちがサッカーをして遊んでいる様子が映されています。青空の下で楽しそうに走り回る子供たちの笑顔が印象的です。
  //
```

# エンベディング（文字列のベクトル表現化）をする例
```JavaScript
  // ==== エンベディング（ベクトル化）の例 ====
  params = {
    model: "text-embedding-004", // embeddingsを使うときはこのモデルを指定
    taskType: "RETRIEVAL_DOCUMENT" // タスクタイプを指定
  };

  result = client.simpleEmbedding(["わーい"], params);
  Logger.log(result);
  // 出力例；
  // [
  //   0.002589861,
  //   0.013294913,
  //   -0.079392985,
  //   ⋮
  // ]
```

# バッチエンベディングの例
```JavaScript
  // ==== 複数テキストの一括エンベディング例 ====
  const texts = ["こんにちは", "さようなら", "ありがとう"];
  
  params = {
    model: "text-embedding-004",
    taskType: "RETRIEVAL_DOCUMENT"
  };

  result = client.simpleEmbedding(texts, params);
  Logger.log(result);
  // 出力例：
  // [
  //   [0.002589861, 0.013294913, -0.079392985, ...], // "こんにちは"のベクトル
  //   [0.003421567, 0.021534678, -0.056789234, ...], // "さようなら"のベクトル
  //   [0.001234567, 0.098765432, -0.012345678, ...]  // "ありがとう"のベクトル
  // ]
```

## OpenAI版との機能比較

| 機能 | OpenAI版 | Gemini版 | 備考 |
|------|----------|----------|------|
| テキスト生成 | ✅ | ✅ | 同じインターフェース |
| JSON出力 | ✅ | ✅ | 同じインターフェース |
| 画像分析 | ✅ | ✅ | 同じインターフェース |
| 画像生成 | ✅ DALL-E | ✅ Imagen4 | Geminiの方が高品質 |
| 音声文字起こし | ✅ Whisper | ❌ | Geminiは非対応 |
| Function Calling | ✅ | ✅ | Tool Use として実装 |
| エンベディング | ✅ | ✅ | バッチ処理対応 |
| 動画分析 | ❌ | ✅ | **Gemini独自の新機能** |

## モデル一覧

### テキスト生成・画像分析
- `gemini-2.5-flash` (デフォルト) - 最新の高速モデル
- `gemini-2.5-pro` - より高性能なモデル
- `gemini-2.0-flash` - 安定版モデル

### 画像生成
- `imagen-4` (デフォルト) - 最新の画像生成モデル

### エンベディング
- `text-embedding-004` (デフォルト) - 最新のエンベディングモデル

## API制限事項

- **コンテキスト長**: モデルによって異なる（Gemini 2.5では最大1M トークン）
- **画像ファイル**: 20MB以下推奨
- **動画ファイル**: 対応形式に制限あり
- **レート制限**: 自動リトライ機能で対応

## エラーハンドリング

ライブラリは以下のエラーに対して自動的にリトライします：
- HTTP 429 (Too Many Requests)
- HTTP 500 (Internal Server Error)  
- HTTP 503 (Service Unavailable)

```javascript
// エラーハンドリングの例
try {
  const result = client.simpleChat("Hello");
  Logger.log(result);
} catch (error) {
  Logger.log("エラーが発生しました: " + error.message);
}
```

## セキュリティ

- APIキーは環境変数やPropertiesServiceで安全に管理してください
- 本番環境では適切なアクセス制御を実装してください
- 生成されたコンテンツは適切にレビューしてください

## ライセンス

MITライセンス（OpenAI版と同じ）