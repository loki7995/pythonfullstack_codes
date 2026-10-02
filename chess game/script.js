const boardEl = document.getElementById("board");
const turnIndicatorEl = document.getElementById("turn-indicator");
const statusTextEl = document.getElementById("status-text");
const newGameBtn = document.getElementById("new-game");
const undoBtn = document.getElementById("undo-move");

const PIECE_SYMBOLS = {
  w: { p: "♙", r: "♖", n: "♘", b: "♗", q: "♕", k: "♔" },
  b: { p: "♟", r: "♜", n: "♞", b: "♝", q: "♛", k: "♚" },
};

const boardSize = 8;
let board = [];
let currentTurn = "w";
let selectedSquare = null;
let legalMoves = [];
let gameOver = false;
let lastMove = null;
let moveHistory = [];
let gameMessage = "White to play.";

function cloneBoard(source) {
  return source.map((row) => row.map((piece) => (piece ? { ...piece } : null)));
}

function createInitialBoard() {
  const initial = Array.from({ length: 8 }, () => Array(8).fill(null));
  const backRank = ["r", "n", "b", "q", "k", "b", "n", "r"];

  for (let col = 0; col < 8; col += 1) {
    initial[0][col] = { type: backRank[col], color: "b" };
    initial[1][col] = { type: "p", color: "b" };
    initial[6][col] = { type: "p", color: "w" };
    initial[7][col] = { type: backRank[col], color: "w" };
  }

  return initial;
}

function startNewGame() {
  board = createInitialBoard();
  currentTurn = "w";
  selectedSquare = null;
  legalMoves = [];
  gameOver = false;
  lastMove = null;
  moveHistory = [];
  gameMessage = "White to play.";
  updateStatus();
  renderBoard();
}

function inBounds(row, col) {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function isEmptySquare(row, col) {
  return inBounds(row, col) && board[row][col] === null;
}

function getPieceAt(row, col) {
  if (!inBounds(row, col)) return null;
  return board[row][col];
}

function getKingPosition(color) {
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const piece = board[row][col];
      if (piece && piece.color === color && piece.type === "k") {
        return { row, col };
      }
    }
  }
  return null;
}

function isSquareAttacked(targetRow, targetCol, byColor) {
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const piece = board[row][col];
      if (!piece || piece.color !== byColor) continue;

      const rowDiff = targetRow - row;
      const colDiff = targetCol - col;

      switch (piece.type) {
        case "p": {
          const dir = byColor === "w" ? -1 : 1;
          if (rowDiff === dir && (colDiff === 1 || colDiff === -1)) {
            return true;
          }
          break;
        }
        case "n": {
          const options = [
            [2, 1],
            [2, -1],
            [-2, 1],
            [-2, -1],
            [1, 2],
            [1, -2],
            [-1, 2],
            [-1, -2],
          ];
          if (options.some(([dr, dc]) => dr === rowDiff && dc === colDiff)) {
            return true;
          }
          break;
        }
        case "b":
        case "r":
        case "q": {
          const directions = [];
          if (piece.type === "b" || piece.type === "q") {
            directions.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
          }
          if (piece.type === "r" || piece.type === "q") {
            directions.push([1, 0], [-1, 0], [0, 1], [0, -1]);
          }

          for (const [dr, dc] of directions) {
            let rr = row + dr;
            let cc = col + dc;
            while (inBounds(rr, cc)) {
              if (rr === targetRow && cc === targetCol) {
                return true;
              }
              if (board[rr][cc]) break;
              rr += dr;
              cc += dc;
            }
          }
          break;
        }
        case "k": {
          const kingMoves = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
            [1, 1],
            [1, -1],
            [-1, 1],
            [-1, -1],
          ];
          if (kingMoves.some(([dr, dc]) => dr === rowDiff && dc === colDiff)) {
            return true;
          }
          break;
        }
        default:
          break;
      }
    }
  }

  return false;
}

function isColorInCheck(color) {
  const king = getKingPosition(color);
  if (!king) return false;
  return isSquareAttacked(king.row, king.col, color === "w" ? "b" : "w");
}

function generatePseudoMovesForPiece(row, col) {
  const piece = board[row][col];
  if (!piece) return [];

  const result = [];
  const { type, color } = piece;

  if (type === "p") {
    const direction = color === "w" ? -1 : 1;
    const startRow = color === "w" ? 6 : 1;
    const oneStepRow = row + direction;

    if (inBounds(oneStepRow, col) && !board[oneStepRow][col]) {
      result.push({ row: oneStepRow, col });

      const twoStepRow = row + direction * 2;
      if (row === startRow && !board[twoStepRow][col]) {
        result.push({ row: twoStepRow, col });
      }
    }

    for (const offset of [-1, 1]) {
      const targetCol = col + offset;
      const targetRow = row + direction;
      if (!inBounds(targetRow, targetCol)) continue;

      const targetPiece = board[targetRow][targetCol];
      if (targetPiece && targetPiece.color !== color) {
        result.push({ row: targetRow, col: targetCol });
      }
    }
  }

  if (type === "r" || type === "b" || type === "q") {
    const directions = [];
    if (type === "r" || type === "q") {
      directions.push([1, 0], [-1, 0], [0, 1], [0, -1]);
    }
    if (type === "b" || type === "q") {
      directions.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
    }

    for (const [dr, dc] of directions) {
      let rr = row + dr;
      let cc = col + dc;
      while (inBounds(rr, cc)) {
        const target = board[rr][cc];
        if (!target) {
          result.push({ row: rr, col: cc });
        } else {
          if (target.color !== color) {
            result.push({ row: rr, col: cc });
          }
          break;
        }
        rr += dr;
        cc += dc;
      }
    }
  }

  if (type === "n") {
    const knightMoves = [
      [2, 1],
      [2, -1],
      [-2, 1],
      [-2, -1],
      [1, 2],
      [1, -2],
      [-1, 2],
      [-1, -2],
    ];

    for (const [dr, dc] of knightMoves) {
      const rr = row + dr;
      const cc = col + dc;
      if (!inBounds(rr, cc)) continue;
      const target = board[rr][cc];
      if (!target || target.color !== color) {
        result.push({ row: rr, col: cc });
      }
    }
  }

  if (type === "k") {
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dr === 0 && dc === 0) continue;
        const rr = row + dr;
        const cc = col + dc;
        if (!inBounds(rr, cc)) continue;
        const target = board[rr][cc];
        if (!target || target.color !== color) {
          result.push({ row: rr, col: cc });
        }
      }
    }
  }

  return result;
}

function isMoveLegal(fromRow, fromCol, toRow, toCol) {
  const piece = board[fromRow][fromCol];
  if (!piece) return false;

  const target = board[toRow][toCol];
  if (target && target.color === piece.color) return false;

  const moves = generatePseudoMovesForPiece(fromRow, fromCol);
  const validMove = moves.some(
    (move) => move.row === toRow && move.col === toCol,
  );
  if (!validMove) return false;

  const simulatedBoard = cloneBoard(board);
  const movingPiece = simulatedBoard[fromRow][fromCol];
  simulatedBoard[toRow][toCol] = movingPiece;
  simulatedBoard[fromRow][fromCol] = null;

  const kingPosition = getKingPosition(piece.color, simulatedBoard);
  const enemyColor = piece.color === "w" ? "b" : "w";

  if (!kingPosition) return false;
  return !isSquareAttacked(
    kingPosition.row,
    kingPosition.col,
    enemyColor,
    simulatedBoard,
  );
}

function getKingPosition(color, customBoard = board) {
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const piece = customBoard[row][col];
      if (piece && piece.color === color && piece.type === "k") {
        return { row, col };
      }
    }
  }
  return null;
}

function isSquareAttacked(targetRow, targetCol, byColor, customBoard = board) {
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const piece = customBoard[row][col];
      if (!piece || piece.color !== byColor) continue;

      const rowDiff = targetRow - row;
      const colDiff = targetCol - col;

      switch (piece.type) {
        case "p": {
          const dir = byColor === "w" ? -1 : 1;
          if (rowDiff === dir && (colDiff === 1 || colDiff === -1)) return true;
          break;
        }
        case "n": {
          const options = [
            [2, 1],
            [2, -1],
            [-2, 1],
            [-2, -1],
            [1, 2],
            [1, -2],
            [-1, 2],
            [-1, -2],
          ];
          if (options.some(([dr, dc]) => dr === rowDiff && dc === colDiff))
            return true;
          break;
        }
        case "b":
        case "r":
        case "q": {
          const directions = [];
          if (piece.type === "b" || piece.type === "q")
            directions.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
          if (piece.type === "r" || piece.type === "q")
            directions.push([1, 0], [-1, 0], [0, 1], [0, -1]);

          for (const [dr, dc] of directions) {
            let rr = row + dr;
            let cc = col + dc;
            while (inBounds(rr, cc)) {
              if (rr === targetRow && cc === targetCol) return true;
              if (customBoard[rr][cc]) break;
              rr += dr;
              cc += dc;
            }
          }
          break;
        }
        case "k": {
          const kingMoves = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
            [1, 1],
            [1, -1],
            [-1, 1],
            [-1, -1],
          ];
          if (kingMoves.some(([dr, dc]) => dr === rowDiff && dc === colDiff))
            return true;
          break;
        }
      }
    }
  }

  return false;
}

function getLegalMovesForColor(color) {
  const moves = [];

  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const piece = board[row][col];
      if (!piece || piece.color !== color) continue;

      const pseudo = generatePseudoMovesForPiece(row, col);
      for (const move of pseudo) {
        if (isMoveLegal(row, col, move.row, move.col)) {
          moves.push({ from: [row, col], to: [move.row, move.col] });
        }
      }
    }
  }

  return moves;
}

function updateStatus() {
  const sideName = currentTurn === "w" ? "White" : "Black";
  turnIndicatorEl.textContent = `${sideName} to move`;

  if (gameOver) {
    statusTextEl.textContent = gameMessage;
    return;
  }

  const kingCheck = isColorInCheck(currentTurn);
  const legal = getLegalMovesForColor(currentTurn);

  if (kingCheck && legal.length === 0) {
    gameOver = true;
    const winner = currentTurn === "w" ? "Black" : "White";
    gameMessage = `${winner} wins by checkmate.`;
    statusTextEl.textContent = gameMessage;
    return;
  }

  if (!kingCheck && legal.length === 0) {
    gameOver = true;
    gameMessage = "Stalemate: draw game.";
    statusTextEl.textContent = gameMessage;
    return;
  }

  if (kingCheck) {
    gameMessage = `${sideName} is in check.`;
  } else {
    gameMessage = `${sideName} to play.`;
  }

  statusTextEl.textContent = gameMessage;
}

function renderBoard() {
  boardEl.innerHTML = "";
  const checkedKing = gameOver ? null : getKingPosition(currentTurn);

  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const square = document.createElement("button");
      square.type = "button";
      square.className = `square ${(row + col) % 2 === 0 ? "light" : "dark"}`;
      square.setAttribute("role", "gridcell");
      square.dataset.row = String(row);
      square.dataset.col = String(col);

      if (
        selectedSquare &&
        selectedSquare.row === row &&
        selectedSquare.col === col
      ) {
        square.classList.add("selected");
      }

      const legalTarget = legalMoves.some(
        (move) => move.to[0] === row && move.to[1] === col,
      );

      if (legalTarget) {
        const targetPiece = board[row][col];
        square.classList.add(targetPiece ? "capture" : "legal");
      }

      if (checkedKing && checkedKing.row === row && checkedKing.col === col) {
        square.classList.add("in-check");
      }

      const piece = board[row][col];
      if (piece) {
        const pieceEl = document.createElement("span");
        pieceEl.className = `piece ${piece.color === "w" ? "white-piece" : "black-piece"}`;
        pieceEl.textContent = PIECE_SYMBOLS[piece.color][piece.type];
        square.appendChild(pieceEl);
      }

      square.addEventListener("click", () => handleSquareClick(row, col));
      boardEl.appendChild(square);
    }
  }
}

function handleSquareClick(row, col) {
  if (gameOver) return;

  const piece = board[row][col];

  if (selectedSquare) {
    const fromRow = selectedSquare.row;
    const fromCol = selectedSquare.col;

    const targetMove = legalMoves.find(
      (move) =>
        move.from[0] === fromRow &&
        move.from[1] === fromCol &&
        move.to[0] === row &&
        move.to[1] === col,
    );

    if (targetMove) {
      makeMove(fromRow, fromCol, row, col);
      return;
    }

    if (piece && piece.color === currentTurn) {
      selectPiece(row, col);
      return;
    }

    selectedSquare = null;
    legalMoves = [];
    renderBoard();
    return;
  }

  if (piece && piece.color === currentTurn) {
    selectPiece(row, col);
  }
}

function selectPiece(row, col) {
  selectedSquare = { row, col };
  legalMoves = [];

  const piece = board[row][col];
  if (!piece || piece.color !== currentTurn) return;

  const moves = generatePseudoMovesForPiece(row, col);
  legalMoves = moves.filter((move) =>
    isMoveLegal(row, col, move.row, move.col),
  );
  renderBoard();
}

function makeMove(fromRow, fromCol, toRow, toCol) {
  const piece = board[fromRow][fromCol];
  const capturedPiece = board[toRow][toCol];

  moveHistory.push({
    from: [fromRow, fromCol],
    to: [toRow, toCol],
    piece,
    captured: capturedPiece,
    board: cloneBoard(board),
  });

  board[toRow][toCol] = piece;
  board[fromRow][fromCol] = null;

  if (piece.type === "p" && (toRow === 0 || toRow === 7)) {
    board[toRow][toCol] = { type: "q", color: piece.color };
  }

  lastMove = { from: [fromRow, fromCol], to: [toRow, toCol] };
  currentTurn = currentTurn === "w" ? "b" : "w";
  selectedSquare = null;
  legalMoves = [];

  updateStatus();
  renderBoard();
}

function undoMove() {
  if (moveHistory.length === 0) return;

  const prevState = moveHistory.pop();
  board = prevState.board;
  currentTurn = currentTurn === "w" ? "b" : "w";
  selectedSquare = null;
  legalMoves = [];
  gameOver = false;
  gameMessage = `${currentTurn === "w" ? "White" : "Black"} to play.`;
  updateStatus();
  renderBoard();
}

newGameBtn.addEventListener("click", startNewGame);
undoBtn.addEventListener("click", undoMove);

startNewGame();
