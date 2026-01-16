#!/usr/bin/env node

/**
 * PRISM Enhanced Search Module
 * Provides fuzzy matching, stemming, and advanced search algorithms
 */

class FuzzySearch {
  constructor() {
    // Common English stem suffixes
    this.stemSuffixes = [
      'ing', 'ed', 'es', 's', 'ly', 'tion', 'able', 'ible',
      'al', 'ive', 'ous', 'an', 'ic', 'ical', 'ful', 'less'
    ];

    // Common word variations for fuzzy matching
    this.fuzzyMap = {
      'import': ['import', 'imports', 'imported', 'importing'],
      'function': ['function', 'functions', 'functional'],
      'class': ['class', 'classes', 'classy'],
      'module': ['module', 'modules', 'modular'],
      'component': ['component', 'components', 'composite'],
      'service': ['service', 'services', 'serviceable'],
      'utils': ['utils', 'utility', 'utilize'],
      'config': ['config', 'configuration', 'configure'],
      'types': ['types', 'type', 'typo'],
      'hooks': ['hooks', 'hooked', 'hooking'],
      'state': ['state', 'states', 'static'],
      'props': ['props', 'properties', 'propagate'],
      'const': ['const', 'constant', 'constants'],
      'let': ['let', 'letter', 'letters'],
      'var': ['var', 'variable', 'variables']
    };
  }

  /**
   * Perform advanced fuzzy search with multiple algorithms
   */
  fuzzySearch(query, text, threshold = 0.6) {
    const results = [];
    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();

    // 1. Levenshtein distance
    const levenshteinScore = this.levenshteinSimilarity(queryLower, textLower);
    if (levenshteinScore >= threshold) {
      results.push({
        type: 'levenshtein',
        score: levenshteinScore,
        text: this.getBestSnippet(query, text)
      });
    }

    // 2. Jaro-Winkler similarity
    const jaroScore = this.jaroWinklerSimilarity(queryLower, textLower);
    if (jaroScore >= threshold) {
      results.push({
        type: 'jaro-winkler',
        score: jaroScore,
        text: this.getBestSnippet(query, text)
      });
    }

    // 3. Soundex matching
    const soundexScore = this.soundexSimilarity(query, text);
    if (soundexScore >= threshold) {
      results.push({
        type: 'soundex',
        score: soundexScore,
        text: this.getBestSnippet(query, text)
      });
    }

    // 4. N-gram similarity
    const ngramScore = this.ngramSimilarity(queryLower, textLower, 2);
    if (ngramScore >= threshold) {
      results.push({
        type: 'ngram',
        score: ngramScore,
        text: this.getBestSnippet(query, text)
      });
    }

    // 5. Prefix matching (for autocompletion-like queries)
    const prefixScore = this.prefixSimilarity(queryLower, textLower);
    if (prefixScore >= threshold) {
      results.push({
        type: 'prefix',
        score: prefixScore,
        text: this.getBestSnippet(query, text)
      });
    }

    // 6. Suffix matching (for ending patterns)
    const suffixScore = this.suffixSimilarity(queryLower, textLower);
    if (suffixScore >= threshold) {
      results.push({
        type: 'suffix',
        score: suffixScore,
        text: this.getBestSnippet(query, text)
      });
    }

    // Return best result
    return results.sort((a, b) => b.score - a.score)[0] || null;
  }

  /**
   * Extract words with stemming support and multi-word optimization
   */
  extractSearchTerms(text, query) {
    const words = text.toLowerCase().split(/\s+/);
    const queryWords = query.toLowerCase().split(/\s+/);
    const terms = new Set();

    // Add original words
    words.forEach(word => {
      if (word.length > 2) {
        terms.add(word);
        terms.add(this.stemWord(word));
      }
    });

    // Add fuzzy variations
    queryWords.forEach(queryWord => {
      const variations = this.getFuzzyVariations(queryWord);
      variations.forEach(variation => terms.add(variation));
    });

    // Multi-word query optimization
    if (queryWords.length > 1) {
      // Add phrase variations
      const phraseVariations = this.generatePhraseVariations(queryWords);
      phraseVariations.forEach(variation => terms.add(variation.toLowerCase()));
    }

    return Array.from(terms);
  }

  /**
   * Generate phrase variations for multi-word queries
   */
  generatePhraseVariations(queryWords) {
    const variations = [];
    const length = queryWords.length;

    // Add original phrase
    variations.push(queryWords.join(' '));

    // Add phrase without last word (prefix phrase)
    if (length > 1) {
      variations.push(queryWords.slice(0, -1).join(' '));
    }

    // Add phrase without first word (suffix phrase)
    if (length > 1) {
      variations.push(queryWords.slice(1).join(' '));
    }

    // Add individual words with context
    queryWords.forEach((word, index) => {
      // Add word with preceding context
      if (index > 0) {
        variations.push(queryWords[index - 1] + ' ' + word);
      }
      // Add word with following context
      if (index < length - 1) {
        variations.push(word + ' ' + queryWords[index + 1]);
      }
    });

    // Add common programming patterns
    if (this.isCodePattern(queryWords.join(' '))) {
      variations.push(this.normalizeCodePattern(queryWords.join(' ')));
    }

    return [...new Set(variations)];
  }

  /**
   * Check if text matches common code patterns
   */
  isCodePattern(text) {
    const patterns = [
      /\.js$/, /\.ts$/, /\.jsx$/, /\.tsx$/,
      /function\s+\w+/, /class\s+\w+/, /import\s+/,
      /require\s*\(/, /export\s+/, /const\s+\w+/,
      /let\s+\w+/, /var\s+\w+/, /\.map\b/, /\.reduce\b/,
      /\.filter\b/, /\.find\b/, /\.forEach\b/
    ];

    return patterns.some(pattern => pattern.test(text));
  }

  /**
   * Normalize code patterns for better matching
   */
  normalizeCodePattern(pattern) {
    // Convert common code patterns to searchable forms
    const normalized = pattern
      .replace(/\./g, ' ') // Convert dots to spaces
      .replace(/function\s+/g, 'function ')
      .replace(/class\s+/g, 'class ')
      .replace(/import\s+/g, 'import ')
      .replace(/export\s+/g, 'export ')
      .replace(/const\s+/g, 'const ')
      .replace(/let\s+/g, 'let ')
      .replace(/var\s+/g, 'var ')
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();

    return normalized;
  }

  /**
   * Stem a word (basic stemming algorithm)
   */
  stemWord(word) {
    if (word.length <= 3) return word;

    // Remove common suffixes
    for (const suffix of this.stemSuffixes) {
      if (word.endsWith(suffix) && word.length > suffix.length + 2) {
        return word.slice(0, -suffix.length);
      }
    }

    return word;
  }

  /**
   * Get fuzzy variations for a word
   */
  getFuzzyVariations(word) {
    const variations = [word];

    // Check if we have predefined variations
    if (this.fuzzyMap[word]) {
      variations.push(...this.fuzzyMap[word]);
    }

    // Generate common variations
    if (word.endsWith('s') && word.length > 1) {
      variations.push(word.slice(0, -1)); // plural
    }

    if (word.endsWith('ing') && word.length > 3) {
      variations.push(word.slice(0, -3)); // present to base
    }

    if (word.endsWith('ed') && word.length > 2) {
      variations.push(word.slice(0, -2)); // past to base
    }

    return [...new Set(variations)];
  }

  /**
   * Levenshtein distance algorithm
   */
  levenshteinDistance(a, b) {
    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Calculate Levenshtein similarity (0-1)
   */
  levenshteinSimilarity(a, b) {
    if (a === b) return 1.0;
    if (a.length === 0 || b.length === 0) return 0.0;

    const distance = this.levenshteinDistance(a, b);
    const maxLength = Math.max(a.length, b.length);

    return 1 - (distance / maxLength);
  }

  /**
   * Jaro-Winkler similarity algorithm
   */
  jaroWinklerSimilarity(a, b) {
    if (a === b) return 1.0;
    if (a.length === 0 || b.length === 0) return 0.0;

    const aLen = a.length;
    const bLen = b.length;
    const matchDistance = Math.floor(Math.max(aLen, bLen) / 2) - 1;

    let aMatches = new Array(aLen).fill(false);
    let bMatches = new Array(bLen).fill(false);
    let matches = 0;

    // Find matches
    for (let i = 0; i < aLen; i++) {
      const start = Math.max(0, i - matchDistance);
      const end = Math.min(i + matchDistance + 1, bLen);

      for (let j = start; j < end; j++) {
        if (bMatches[j] || a.charAt(i) !== b.charAt(j)) {
          continue;
        }
        aMatches[i] = true;
        bMatches[j] = true;
        matches++;
        break;
      }
    }

    if (matches === 0) return 0.0;

    // Transpositions
    let k = 0;
    let transpositions = 0;
    for (let i = 0; i < aLen; i++) {
      if (!aMatches[i]) continue;
      while (!bMatches[k]) k++;
      if (a.charAt(i) !== b.charAt(k)) transpositions++;
      k++;
    }
    transpositions = Math.floor(transpositions / 2);

    const jaro = (matches / aLen + matches / bLen + (matches - transpositions) / matches) / 3;

    // Winkler bonus
    let commonPrefixLength = 0;
    const maxPrefixLength = 4;
    for (let i = 0; i < Math.min(maxPrefixLength, Math.min(aLen, bLen)); i++) {
      if (a.charAt(i) === b.charAt(i)) {
        commonPrefixLength++;
      } else {
        break;
      }
    }

    return jaro + commonPrefixLength * 0.1 * (1 - jaro);
  }

  /**
   * Soundex algorithm for phonetic matching
   */
  soundexSimilarity(a, b) {
    const soundexA = this.soundex(a);
    const soundexB = this.soundex(b);

    return soundexA === soundexB ? 1.0 : 0.0;
  }

  /**
   * Soundex encoding
   */
  soundex(word) {
    if (!word) return '';

    const soundexMap = {
      'a': '0', 'e': '0', 'i': '0', 'o': '0', 'u': '0', 'y': '0',
      'b': '1', 'f': '1', 'p': '1', 'v': '1',
      'c': '2', 'g': '2', 'j': '2', 'k': '2', 'q': '2', 's': '2', 'x': '2', 'z': '2',
      'd': '3', 't': '3',
      'l': '4',
      'm': '5', 'n': '5',
      'r': '6'
    };

    const firstChar = word.charAt(0).toUpperCase();
    let soundex = firstChar;
    let prevCode = soundexMap[firstChar.toLowerCase()] || '0';

    for (let i = 1; i < word.length && soundex.length < 4; i++) {
      const char = word.charAt(i);
      const code = soundexMap[char.toLowerCase()];

      if (code && code !== '0' && code !== prevCode) {
        soundex += code;
        prevCode = code;
      }
    }

    // Pad with zeros
    while (soundex.length < 4) {
      soundex += '0';
    }

    return soundex.slice(0, 4);
  }

  /**
   * N-gram similarity
   */
  ngramSimilarity(a, b, n = 2) {
    const aGrams = this.getNGrams(a, n);
    const bGrams = this.getNGrams(b, n);

    if (aGrams.size === 0 || bGrams.size === 0) return 0.0;

    const intersection = new Set([...aGrams].filter(x => bGrams.has(x)));
    const union = new Set([...aGrams, ...bGrams]);

    return intersection.size / union.size;
  }

  /**
   * Prefix similarity (for autocompletion-like queries)
   */
  prefixSimilarity(query, text) {
    if (query.length === 0) return 0.0;

    let matchingLength = 0;
    const minLength = Math.min(query.length, text.length);

    for (let i = 0; i < minLength; i++) {
      if (query[i] === text[i]) {
        matchingLength++;
      } else {
        break;
      }
    }

    // Score based on how much of the query matches the prefix
    const prefixScore = matchingLength / query.length;

    // Bonus for exact prefix match
    if (matchingLength === query.length) {
      return Math.min(prefixScore + 0.3, 1.0);
    }

    return prefixScore;
  }

  /**
   * Suffix similarity (for ending patterns)
   */
  suffixSimilarity(query, text) {
    if (query.length === 0) return 0.0;

    let matchingLength = 0;
    const queryEnd = query.length - 1;
    const textEnd = text.length - 1;
    const minLength = Math.min(query.length, text.length);

    for (let i = 0; i < minLength; i++) {
      if (query[queryEnd - i] === text[textEnd - i]) {
        matchingLength++;
      } else {
        break;
      }
    }

    // Score based on how much of the query matches the suffix
    const suffixScore = matchingLength / query.length;

    // Bonus for exact suffix match
    if (matchingLength === query.length) {
      return Math.min(suffixScore + 0.3, 1.0);
    }

    return suffixScore;
  }

  /**
   * Extract n-grams from text
   */
  getNGrams(text, n) {
    const grams = new Set();

    for (let i = 0; i <= text.length - n; i++) {
      grams.add(text.substring(i, i + n));
    }

    return grams;
  }

  /**
   * Get best snippet containing query
   */
  getBestSnippet(query, text) {
    const lines = text.split('\n');
    const queryLower = query.toLowerCase();

    for (const line of lines) {
      if (line.toLowerCase().includes(queryLower)) {
        return line.trim();
      }
    }

    // If no exact match, return first line
    return lines[0]?.trim() || text.substring(0, 100) + '...';
  }

  /**
   * Advanced search with context-aware ranking and fuzzy matching
   */
  advancedSearch(query, indexedFiles, options = {}) {
    const {
      threshold = 0.3,
      maxResults = 10,
      fuzzy = true,
      stem = true,
      contextAware = true
    } = options;

    const results = [];
    const queryTerms = this.extractSearchTerms(query, query);
    const isCodeSearch = this.isCodeRelatedQuery(query);

    for (const [filePath, fileData] of Object.entries(indexedFiles)) {
      let totalScore = 0;
      let bestSnippet = '';
      let contextScore = 0;

      // Standard matching
      const standardScore = this.standardMatch(query, filePath, fileData.content, queryTerms);
      totalScore += standardScore.score;

      // Fuzzy matching if enabled
      if (fuzzy && fileData.content) {
        const fuzzyResult = this.fuzzySearch(query, fileData.content, threshold);
        if (fuzzyResult) {
          totalScore += fuzzyResult.score * 0.5; // Weight fuzzy matches less
          bestSnippet = fuzzyResult.text;
        }
      }

      // Context-aware scoring if enabled
      if (contextAware) {
        contextScore = this.calculateContextScore(query, filePath, fileData.content, queryTerms, isCodeSearch);
        totalScore += contextScore;
      }

      if (totalScore > threshold) {
        results.push({
          file: filePath,
          content: bestSnippet || this.getBestSnippet(query, fileData.content),
          score: Math.min(totalScore, 1.0),
          line: this.findMatchLine(fileData.content, queryTerms),
          context: contextScore > 0 ? {
            type: isCodeSearch ? 'code' : 'general',
            relevance: contextScore
          } : null
        });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  }

  /**
   * Check if query is code-related
   */
  isCodeRelatedQuery(query) {
    const codeKeywords = [
      'function', 'class', 'method', 'variable', 'parameter', 'argument',
      'import', 'export', 'require', 'module', 'component', 'service',
      'hook', 'state', 'props', 'const', 'let', 'var', 'type', 'interface',
      'extends', 'implements', 'constructor', 'destructor', 'async', 'await',
      'promise', 'callback', 'event', 'handler', 'api', 'endpoint'
    ];

    const queryLower = query.toLowerCase();
    return codeKeywords.some(keyword => queryLower.includes(keyword));
  }

  /**
   * Calculate context-aware score
   */
  calculateContextScore(query, filePath, content, queryTerms, isCodeSearch) {
    let contextScore = 0;

    // File path context
    contextScore += this.scoreFileContext(filePath, queryTerms, isCodeSearch);

    // Content context
    if (content) {
      contextScore += this.scoreContentContext(content, queryTerms, isCodeSearch);
    }

    // Project structure context
    contextScore += this.scoreProjectStructureContext(filePath, isCodeSearch);

    // Query type context
    if (isCodeSearch) {
      contextScore += this.scoreCodeContext(query, content);
    }

    return Math.min(contextScore, 0.3); // Cap context scoring at 0.3
  }

  /**
   * Score file path context
   */
  scoreFileContext(filePath, queryTerms, isCodeSearch) {
    let score = 0;
    const lowerPath = filePath.toLowerCase();

    // Prefer source files for code searches
    if (isCodeSearch) {
      if (lowerPath.includes('/src/') || lowerPath.includes('/lib/') || lowerPath.includes('/app/')) {
        score += 0.1;
      }

      // Prefer specific code directories
      const codeDirs = ['/components/', '/utils/', '/services/', '/hooks/', '/types/'];
      if (codeDirs.some(dir => lowerPath.includes(dir))) {
        score += 0.05;
      }
    }

    // Penalize test files unless query includes "test"
    if (!queryTerms.some(term => term.includes('test')) &&
        (lowerPath.includes('/test/') || lowerPath.includes('/tests/') || lowerPath.includes('__test__'))) {
      score -= 0.05;
    }

    // Documentation preference for help queries
    if (queryTerms.some(term => ['help', 'docs', 'documentation', 'guide'].includes(term))) {
      if (lowerPath.includes('/docs/') || filePath.endsWith('.md') || filePath.includes('/README')) {
        score += 0.1;
      }
    }

    return Math.max(0, score);
  }

  /**
   * Score content context
   */
  scoreContentContext(content, queryTerms, isCodeSearch) {
    let score = 0;
    const contentLower = content.toLowerCase();

    // Code pattern matching for code searches
    if (isCodeSearch) {
      const codePatterns = [
        /\bfunction\s+\w+\s*\(/gi,
        /\bclass\s+\w+/gi,
        /\bimport\s+.*from/gi,
        /\bexport\s+(default|const|let|var|function)/gi,
        /\bconst\s+\w+\s*=/gi,
        /\blet\s+\w+\s*=/gi,
        /\bvar\s+\w+\s*=/gi
      ];

      let patternMatches = 0;
      codePatterns.forEach(pattern => {
        const matches = contentLower.match(pattern);
        if (matches) patternMatches += matches.length;
      });

      // Bonus for code patterns in the file
      if (patternMatches > 0) {
        score += Math.min(patternMatches * 0.02, 0.1);
      }
    }

    // Query term frequency in content
    queryTerms.forEach(term => {
      const termCount = (contentLower.match(new RegExp(term, 'g')) || []).length;
      if (termCount > 0) {
        score += Math.min(termCount * 0.01, 0.05);
      }
    });

    return Math.max(0, score);
  }

  /**
   * Score project structure context
   */
  scoreProjectStructureContext(filePath, isCodeSearch) {
    let score = 0;
    const pathParts = filePath.split(path.sep);
    const depth = pathParts.length;

    // Prefer files closer to project root (depth 2-4)
    if (depth >= 2 && depth <= 4) {
      score += 0.05;
    }

    // Penalize very deep paths
    if (depth > 6) {
      score -= 0.05;
    }

    // Bonus for common project structure patterns
    const fileName = path.basename(filePath).toLowerCase();
    if (fileName.includes('index') || fileName.includes('main') || fileName.includes('app')) {
      score += 0.03;
    }

    return Math.max(0, score);
  }

  /**
   * Score code context based on query type
   */
  scoreCodeContext(query, content) {
    let score = 0;
    const queryLower = query.toLowerCase();

    // React-specific patterns
    if (queryLower.includes('hook')) {
      if (content.includes('useEffect') || content.includes('useState') || content.includes('useContext')) {
        score += 0.1;
      }
    }

    // TypeScript patterns
    if (queryLower.includes('type') || queryLower.includes('interface')) {
      if (content.includes(':') && content.includes(';') && content.includes('interface')) {
        score += 0.08;
      }
    }

    // JavaScript patterns
    if (queryLower.includes('function') || queryLower.includes('method')) {
      if (content.includes('function') || content.includes('=>') || content.includes('async')) {
        score += 0.06;
      }
    }

    // Module patterns
    if (queryLower.includes('import') || queryLower.includes('export')) {
      if (content.includes('import') || content.includes('require') || content.includes('module.exports')) {
        score += 0.07;
      }
    }

    return Math.max(0, score);
  }

  /**
   * Standard matching algorithm
   */
  standardMatch(query, filePath, content, queryTerms) {
    let score = 0;

    // Filename matching
    score += this.scoreFilenameMatch(query, filePath, queryTerms);

    // Content matching
    if (content) {
      score += this.scoreContentMatch(query, content, queryTerms);
    }

    // Context scoring
    score += this.scoreContext(filePath);

    return { score };
  }

  /**
   * Find the line number of the first match
   */
  findMatchLine(content, queryTerms) {
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();

      for (const term of queryTerms) {
        if (line.includes(term)) {
          return i + 1;
        }
      }
    }

    return 1;
  }

  /**
   * Enhanced filename scoring (same as main server)
   */
  scoreFilenameMatch(query, filePath, queryTerms) {
    let score = 0;
    const fileName = path.basename(filePath).toLowerCase();
    const dirName = path.dirname(filePath).toLowerCase();

    if (fileName === query.toLowerCase()) {
      score += 0.5;
    }

    for (const word of queryTerms) {
      if (fileName.includes(word)) {
        score += 0.2;
        if (fileName.split(/\s+/).some(fileWord => fileWord === word)) {
          score += 0.1;
        }
      }
    }

    for (const word of queryTerms) {
      if (dirName.includes(word)) {
        score += 0.05;
      }
    }

    return Math.min(score, 0.5);
  }

  /**
   * Enhanced content scoring (same as main server)
   */
  scoreContentMatch(query, content, queryTerms) {
    const contentLower = content.toLowerCase();
    const contentWords = contentLower.split(/\s+/);
    let score = 0;

    for (const queryWord of queryTerms) {
      let matches = 0;

      for (const contentWord of contentWords) {
        if (contentWord.includes(queryWord)) {
          matches++;

          if (contentWord === queryWord) {
            score += 0.02;
          }
        }
      }

      const frequencyScore = Math.log(matches + 1) * 0.1;
      score += frequencyScore;
    }

    const uniqueWordsFound = new Set();
    for (const queryWord of queryTerms) {
      if (contentLower.includes(queryWord)) {
        uniqueWordsFound.add(queryWord);
      }
    }

    const coverage = uniqueWordsFound.size / queryTerms.length;
    score += coverage * 0.2;

    return Math.min(score, 0.7);
  }

  /**
   * Context scoring (same as main server)
   */
  scoreContext(filePath) {
    let score = 0;
    const lowerPath = filePath.toLowerCase();

    if (lowerPath.includes('/src/') || lowerPath.includes('/lib/')) {
      score += 0.1;
    }

    if (lowerPath.includes('/docs/') || filePath.endsWith('.md')) {
      score += 0.05;
    }

    if (lowerPath.includes('/test/') || lowerPath.includes('/tests/')) {
      score -= 0.05;
    }

    const pathDepth = filePath.split(path.sep).length;
    const depthBonus = Math.max(0, 0.1 - (pathDepth - 3) * 0.02);
    score += depthBonus;

    return Math.max(0, score);
  }
}

module.exports = FuzzySearch;