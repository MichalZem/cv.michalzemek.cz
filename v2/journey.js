(function () {
  "use strict";

  var storyBody = document.querySelector(".story__body");
  if (!storyBody) return;
  if (window.matchMedia && window.matchMedia("(max-width: 768px)").matches) return;

  var chapters = Array.prototype.slice.call(storyBody.querySelectorAll(".story-chapter"));
  if (!chapters.length) return;

  /* ── Config ─────────────────────────────────────── */
  var CANVAS_W = 220;
  var ROAD_W = 26;
  var CAR_SCALE = 0.85;
  var ICON_PX = 60;
  var BOUNCE_AMP = 12;
  var CAR_COLOR = "#cc2222";
  var CAR_COLOR_DARK = "#991a1a";
  var ACCENT_HEX = "#b85b34";
  var DARK_HEX = "#2a2320";
  var ROAD_COLOR = "#e8e2da";
  var EDGE_COLOR = "#d0c8be";
  var DASH_COLOR = "#ccc4b8";
  var DOT_COLOR = "#b85b34";
  var DOT_RING = "#f3efe9";
  var WAVE_AMP = 8;
  var WAVE_FREQ = 0.008;
  var EDGE_SNAP_PX = 24;
  var DETOUR_RANGE = 92;
  var FREE_DRIVE_MARGIN = 28;
  var FREE_DRIVE_RETURN_RATE = 5.4;
  var FREE_DRIVE_ENTRY_RATE = 0.95;
  var FREE_DRIVE_TIME_SCALE = 0.42;
  var CAR_HIT_HALF_W = 22;
  var CAR_HIT_HALF_H = 18;

  /* ── DOM ────────────────────────────────────────── */
  var rail = document.createElement("div");
  rail.className = "journey-rail";
  storyBody.insertBefore(rail, storyBody.firstChild);
  storyBody.classList.add("has-journey");

  var canvas = document.createElement("canvas");
  canvas.className = "journey-rail__canvas";
  rail.appendChild(canvas);
  var ctx = canvas.getContext("2d");
  var overlayCanvas = document.createElement("canvas");
  overlayCanvas.className = "journey-overlay";
  document.body.appendChild(overlayCanvas);
  var overlayCtx = overlayCanvas.getContext("2d");

  var canvasH = 0;
  var overlayW = 0;
  var overlayH = 0;
  var dpr = Math.min(window.devicePixelRatio, 2);

  function resizeCanvas() {
    canvasH = window.innerHeight;
    overlayW = window.innerWidth;
    overlayH = window.innerHeight;
    canvas.width = CANVAS_W * dpr;
    canvas.height = canvasH * dpr;
    canvas.style.width = CANVAS_W + "px";
    canvas.style.height = canvasH + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    overlayCanvas.width = overlayW * dpr;
    overlayCanvas.height = overlayH * dpr;
    overlayCanvas.style.width = overlayW + "px";
    overlayCanvas.style.height = overlayH + "px";
    overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resizeCanvas();

  /* ── Wavy road center X ────────────────────────── */
  var roadBaseX = 52;

  function roadCenterX(y) {
    return roadBaseX + Math.sin(y * WAVE_FREQ) * WAVE_AMP
      + Math.sin(y * WAVE_FREQ * 2.3 + 1.5) * (WAVE_AMP * 0.4);
  }

  /* ── Section positions (relative to sticky canvas) ── */
  function getChapterMetrics() {
    var canvasRect = canvas.getBoundingClientRect();
    var canvasTop = canvasRect.top;
    var canvasLeft = canvasRect.left;
    var metrics = [];

    chapters.forEach(function (ch) {
      var chRect = ch.getBoundingClientRect();
      var title = ch.querySelector("h2");
      var marker = ch.querySelector(".story-chapter__marker");
      var targetNode = title || marker || ch;
      var targetRect = targetNode.getBoundingClientRect();
      var minTargetX = roadBaseX + ROAD_W / 2 + 5 + ICON_PX + 5;
      var maxTargetX = CANVAS_W - 24;
      var targetX = clamp(targetRect.left - canvasLeft - 36, minTargetX, maxTargetX);
      var detourDistance = targetX - (roadBaseX + ROAD_W / 2);
      var detourLift = clamp(detourDistance * 0.16 + targetRect.height * 0.14, 10, 24);

      metrics.push({
        roadY: chRect.top - canvasTop,
        targetX: targetX,
        detourLift: detourLift
      });
    });

    return metrics;
  }

  /* ── Car drawing (side view, rounded, red) ─────── */
  function drawCar(drawCtx, x, y, rotation) {
    drawCtx.save();
    drawCtx.translate(x, y);
    drawCtx.rotate(rotation);
    drawCtx.scale(CAR_SCALE, CAR_SCALE);

    // Shadow
    drawCtx.fillStyle = "rgba(0,0,0,0.10)";
    drawCtx.beginPath();
    drawCtx.ellipse(0, 13, 17, 4, 0, 0, Math.PI * 2);
    drawCtx.fill();

    // Lower body (rounded)
    drawCtx.fillStyle = CAR_COLOR;
    roundRect(drawCtx, -17, 1, 34, 9, 4);
    drawCtx.fill();

    // Upper body (rounded bubble shape)
    drawCtx.fillStyle = CAR_COLOR;
    drawCtx.beginPath();
    drawCtx.moveTo(-14, 2);
    drawCtx.quadraticCurveTo(-16, 2, -16, 0);
    drawCtx.lineTo(-16, -1);
    drawCtx.quadraticCurveTo(-15, -3, -11, -3);
    drawCtx.lineTo(-9, -3);
    drawCtx.quadraticCurveTo(-8, -10, -5, -11);
    drawCtx.lineTo(5, -11);
    drawCtx.quadraticCurveTo(10, -10, 13, -3);
    drawCtx.lineTo(15, -3);
    drawCtx.quadraticCurveTo(17, -2, 17, 0);
    drawCtx.lineTo(17, 2);
    drawCtx.closePath();
    drawCtx.fill();

    // Roof highlight
    drawCtx.fillStyle = CAR_COLOR_DARK;
    drawCtx.beginPath();
    drawCtx.moveTo(-7, -10);
    drawCtx.quadraticCurveTo(-5, -12, 3, -12);
    drawCtx.quadraticCurveTo(8, -11, 10, -7);
    drawCtx.lineTo(-6, -7);
    drawCtx.closePath();
    drawCtx.fill();

    // Windshield
    drawCtx.fillStyle = "#7cb8d8";
    drawCtx.beginPath();
    drawCtx.moveTo(-5, -9);
    drawCtx.quadraticCurveTo(-4, -10, 4, -10);
    drawCtx.quadraticCurveTo(8, -9, 11, -3);
    drawCtx.lineTo(-7, -3);
    drawCtx.closePath();
    drawCtx.fill();

    // Rear window
    drawCtx.fillStyle = "#7cb8d8";
    drawCtx.beginPath();
    drawCtx.moveTo(-9, -3);
    drawCtx.lineTo(-7, -8);
    drawCtx.quadraticCurveTo(-8, -9, -10, -8);
    drawCtx.lineTo(-13, -3);
    drawCtx.closePath();
    drawCtx.fill();

    // Bumpers (rounded)
    drawCtx.fillStyle = "#ddd";
    roundRect(drawCtx, 14, -1, 3, 5, 1.5);
    drawCtx.fill();
    roundRect(drawCtx, -17, -1, 3, 5, 1.5);
    drawCtx.fill();

    // Wheels
    drawCtx.fillStyle = DARK_HEX;
    drawCtx.beginPath();
    drawCtx.arc(-10, 10, 5.5, 0, Math.PI * 2);
    drawCtx.fill();
    drawCtx.beginPath();
    drawCtx.arc(10, 10, 5.5, 0, Math.PI * 2);
    drawCtx.fill();

    // Wheel arcs (fenders)
    drawCtx.fillStyle = CAR_COLOR_DARK;
    drawCtx.beginPath();
    drawCtx.arc(-10, 8, 7.5, Math.PI, 0);
    drawCtx.lineTo(-2.5, 8);
    drawCtx.lineTo(-2.5, 6);
    drawCtx.arc(-10, 6, 7.5, 0, Math.PI, true);
    drawCtx.closePath();
    drawCtx.fill();
    drawCtx.beginPath();
    drawCtx.arc(10, 8, 7.5, Math.PI, 0);
    drawCtx.lineTo(17.5, 8);
    drawCtx.lineTo(17.5, 6);
    drawCtx.arc(10, 6, 7.5, 0, Math.PI, true);
    drawCtx.closePath();
    drawCtx.fill();

    // Rims (hubcaps)
    drawCtx.fillStyle = "#bbb";
    drawCtx.beginPath();
    drawCtx.arc(-10, 10, 2.8, 0, Math.PI * 2);
    drawCtx.fill();
    drawCtx.beginPath();
    drawCtx.arc(10, 10, 2.8, 0, Math.PI * 2);
    drawCtx.fill();

    // Rim dots
    drawCtx.fillStyle = "#999";
    for (var w = 0; w < 2; w++) {
      var wx = w === 0 ? -10 : 10;
      for (var a = 0; a < 4; a++) {
        var angle = a * Math.PI / 2;
        drawCtx.beginPath();
        drawCtx.arc(wx + Math.cos(angle) * 1.8, 10 + Math.sin(angle) * 1.8, 0.6, 0, Math.PI * 2);
        drawCtx.fill();
      }
    }

    // Headlight
    drawCtx.fillStyle = "#ffe9a0";
    roundRect(drawCtx, 14.5, 0, 3, 3, 1);
    drawCtx.fill();

    // Taillight
    drawCtx.fillStyle = "#cc3333";
    roundRect(drawCtx, -17.5, 0, 2.5, 3, 1);
    drawCtx.fill();

    drawCtx.restore();
  }

  /* ── Draw wavy road ────────────────────────────── */
  function drawRoad() {
    var step = 2;

    // Road fill
    ctx.fillStyle = ROAD_COLOR;
    ctx.beginPath();
    ctx.moveTo(roadCenterX(0) - ROAD_W / 2, 0);
    for (var y = 0; y <= canvasH; y += step) {
      ctx.lineTo(roadCenterX(y) - ROAD_W / 2, y);
    }
    for (var y2 = canvasH; y2 >= 0; y2 -= step) {
      ctx.lineTo(roadCenterX(y2) + ROAD_W / 2, y2);
    }
    ctx.closePath();
    ctx.fill();

    // Left edge
    ctx.strokeStyle = EDGE_COLOR;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(roadCenterX(0) - ROAD_W / 2, 0);
    for (var y3 = 0; y3 <= canvasH; y3 += step) {
      ctx.lineTo(roadCenterX(y3) - ROAD_W / 2, y3);
    }
    ctx.stroke();

    // Right edge
    ctx.beginPath();
    ctx.moveTo(roadCenterX(0) + ROAD_W / 2, 0);
    for (var y4 = 0; y4 <= canvasH; y4 += step) {
      ctx.lineTo(roadCenterX(y4) + ROAD_W / 2, y4);
    }
    ctx.stroke();
  }

  /* ── Draw animated center dashes (follow curve) ── */
  function drawDashes() {
    var dashLen = 8;
    var gapLen = 8;
    var totalLen = dashLen + gapLen;
    var dashOffset = (animTime * 30) % totalLen;

    ctx.strokeStyle = DASH_COLOR;
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";

    var y = -dashOffset;
    while (y < canvasH + totalLen) {
      var startY = y;
      var endY = y + dashLen;
      if (endY > 0 && startY < canvasH) {
        ctx.beginPath();
        ctx.moveTo(roadCenterX(Math.max(0, startY)), Math.max(0, startY));
        for (var sy = Math.max(0, startY); sy <= Math.min(canvasH, endY); sy += 2) {
          ctx.lineTo(roadCenterX(sy), sy);
        }
        ctx.stroke();
      }
      y += totalLen;
    }
  }

  /* ── Draw milestone dots on road at chapter positions ── */
  function drawMilestones(positions, currentIdx) {
    positions.forEach(function (y, i) {
      if (y < -10 || y > canvasH + 10) return;

      var cx = roadCenterX(y);
      var isCurrent = i === currentIdx;

      // Outer ring (bg color)
      ctx.fillStyle = DOT_RING;
      ctx.beginPath();
      ctx.arc(cx, y, isCurrent ? 7 : 5.5, 0, Math.PI * 2);
      ctx.fill();

      // Inner dot (accent)
      ctx.fillStyle = DOT_COLOR;
      ctx.beginPath();
      ctx.arc(cx, y, isCurrent ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Pulse ring on active
      if (isCurrent) {
        var pulse = (Math.sin(animTime * 3) + 1) * 0.5;
        ctx.strokeStyle = DOT_COLOR;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.4 * (1 - pulse);
        ctx.beginPath();
        ctx.arc(cx, y, 7 + pulse * 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Outer border
      ctx.strokeStyle = DOT_COLOR;
      ctx.lineWidth = isCurrent ? 2 : 1.5;
      ctx.beginPath();
      ctx.arc(cx, y, isCurrent ? 7 : 5.5, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  /* ── Icon draw functions ───────────────────────── */
  var iconCanvases = {};

  function createIconCanvas(id) {
    var c = document.createElement("canvas");
    var s = 96;
    c.width = s; c.height = s;
    var ic = c.getContext("2d");
    if (iconFns[id]) iconFns[id](ic, s);
    return c;
  }

  var iconFns = {
    zacatky: function (ctx, s) {
      ctx.fillStyle = "#8f4322";
      roundRect(ctx, s*0.15, s*0.08, s*0.7, s*0.54, 5);
      ctx.fill();
      ctx.fillStyle = "#4a7a5c";
      ctx.fillRect(s*0.22, s*0.14, s*0.56, s*0.4);
      ctx.fillStyle = "#7bc89a";
      for (var i = 0; i < 4; i++)
        ctx.fillRect(s*0.27, s*0.2 + i*s*0.08, s*(0.26 + i*0.06), s*0.03);
      ctx.fillStyle = "#8f4322";
      ctx.fillRect(s*0.42, s*0.62, s*0.16, s*0.12);
      ctx.fillRect(s*0.3, s*0.72, s*0.4, s*0.06);
    },
    praha: function (ctx, s) {
      ctx.fillStyle = "#8f4322";
      ctx.fillRect(s*0.1, s*0.4, s*0.16, s*0.4);
      tri(ctx, s*0.1, s*0.4, s*0.26, s*0.4, s*0.18, s*0.18);
      ctx.fillRect(s*0.34, s*0.3, s*0.32, s*0.5);
      tri(ctx, s*0.34, s*0.3, s*0.66, s*0.3, s*0.5, s*0.06);
      ctx.fillRect(s*0.485, s*0.02, s*0.03, s*0.08);
      ctx.fillRect(s*0.47, s*0.04, s*0.06, s*0.025);
      ctx.fillRect(s*0.74, s*0.44, s*0.16, s*0.36);
      tri(ctx, s*0.74, s*0.44, s*0.9, s*0.44, s*0.82, s*0.24);
      ctx.fillRect(s*0.06, s*0.74, s*0.88, s*0.06);
    },
    freelancing: function (ctx, s) {
      ctx.fillStyle = "#8f4322";
      roundRect(ctx, s*0.18, s*0.1, s*0.64, s*0.45, 4);
      ctx.fill();
      ctx.fillStyle = "#4a6a7a";
      ctx.fillRect(s*0.24, s*0.16, s*0.52, s*0.34);
      ctx.fillStyle = "#7ab8d4";
      ctx.fillRect(s*0.29, s*0.22, s*0.3, s*0.025);
      ctx.fillRect(s*0.29, s*0.28, s*0.38, s*0.025);
      ctx.fillRect(s*0.29, s*0.34, s*0.22, s*0.025);
      ctx.fillStyle = "#d4997a";
      ctx.fillRect(s*0.29, s*0.4, s*0.34, s*0.025);
      ctx.fillStyle = "#a07050";
      roundRect(ctx, s*0.12, s*0.58, s*0.76, s*0.1, 3);
      ctx.fill();
    },
    stavba: function (ctx, s) {
      ctx.fillStyle = "#d4a030";
      ctx.beginPath();
      ctx.arc(s*0.5, s*0.38, s*0.24, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(s*0.18, s*0.36, s*0.64, s*0.07);
      ctx.fillStyle = "#8f4322";
      ctx.fillRect(s*0.62, s*0.52, s*0.05, s*0.36);
      ctx.fillRect(s*0.48, s*0.52, s*0.32, s*0.05);
      ctx.fillStyle = "#666";
      ctx.fillRect(s*0.52, s*0.57, s*0.025, s*0.14);
    },
    biovavrinec: function (ctx, s) {
      drawCowIcon(ctx, s, s*0.02, s*0.06, 1);
      drawCowIcon(ctx, s, s*0.38, s*0.48, 0.82);
    },
    navrat: function (ctx, s) {
      ctx.fillStyle = "#8f4322";
      roundRect(ctx, s*0.36, s*0.18, s*0.28, s*0.52, 8);
      ctx.fill();
      tri(ctx, s*0.36, s*0.2, s*0.5, s*0.02, s*0.64, s*0.2);
      ctx.fillStyle = "#7ab8d4";
      ctx.beginPath(); ctx.arc(s*0.5, s*0.38, s*0.065, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = "#b85b34";
      tri(ctx, s*0.36, s*0.58, s*0.36, s*0.72, s*0.24, s*0.74);
      tri(ctx, s*0.64, s*0.58, s*0.64, s*0.72, s*0.76, s*0.74);
      ctx.fillStyle = "#e8a030";
      tri(ctx, s*0.38, s*0.7, s*0.62, s*0.7, s*0.5, s*0.92);
      ctx.fillStyle = "#e86030";
      tri(ctx, s*0.42, s*0.7, s*0.58, s*0.7, s*0.5, s*0.84);
    },
    "ai-era": function (ctx, s) {
      ctx.fillStyle = "#8f4322";
      roundRect(ctx, s*0.22, s*0.22, s*0.56, s*0.56, 6);
      ctx.fill();
      ctx.strokeStyle = "#b85b34"; ctx.lineWidth = 2;
      for (var i = 0; i < 4; i++) {
        var x = s*(0.32 + i*0.1);
        ctx.beginPath(); ctx.moveTo(x, s*0.22); ctx.lineTo(x, s*0.1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, s*0.78); ctx.lineTo(x, s*0.9); ctx.stroke();
      }
      for (var j = 0; j < 4; j++) {
        var y = s*(0.32 + j*0.1);
        ctx.beginPath(); ctx.moveTo(s*0.22, y); ctx.lineTo(s*0.1, y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s*0.78, y); ctx.lineTo(s*0.9, y); ctx.stroke();
      }
      ctx.fillStyle = "#d4997a";
      ctx.font = "bold " + Math.round(s*0.2) + "px sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("AI", s*0.5, s*0.52);
    },
    zaver: function (ctx, s) {
      ctx.fillStyle = "#8f4322";
      ctx.fillRect(s*0.22, s*0.08, s*0.05, s*0.84);
      var cols = 4, rows = 4;
      var fw = s*0.5, fh = s*0.38;
      var fx = s*0.27, fy = s*0.08;
      var cw = fw/cols, ch = fh/rows;
      for (var r = 0; r < rows; r++)
        for (var c = 0; c < cols; c++) {
          ctx.fillStyle = (r+c)%2===0 ? "#1f1b17" : "#f3efe9";
          ctx.fillRect(fx + c*cw, fy + r*ch, cw, ch);
        }
      ctx.strokeStyle = "#8f4322"; ctx.lineWidth = 1.5;
      ctx.strokeRect(fx, fy, fw, fh);
    }
  };

  /* ── Helpers ────────────────────────────────────── */
  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x+r, y); c.lineTo(x+w-r, y);
    c.quadraticCurveTo(x+w, y, x+w, y+r); c.lineTo(x+w, y+h-r);
    c.quadraticCurveTo(x+w, y+h, x+w-r, y+h); c.lineTo(x+r, y+h);
    c.quadraticCurveTo(x, y+h, x, y+h-r); c.lineTo(x, y+r);
    c.quadraticCurveTo(x, y, x+r, y);
    c.closePath();
  }

  function tri(c, x1, y1, x2, y2, x3, y3) {
    c.beginPath(); c.moveTo(x1,y1); c.lineTo(x2,y2); c.lineTo(x3,y3);
    c.closePath(); c.fill();
  }

  function drawCowIcon(ctx, s, ox, oy, sc) {
    ctx.save(); ctx.translate(ox, oy); ctx.scale(sc, sc);
    ctx.fillStyle = "#f5f0e8";
    ctx.beginPath();
    ctx.ellipse(s*0.26, s*0.22, s*0.24, s*0.13, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#2a2320";
    ctx.beginPath(); ctx.ellipse(s*0.2, s*0.18, s*0.065, s*0.04, 0.3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s*0.34, s*0.24, s*0.055, s*0.04, -0.2, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#f5f0e8";
    ctx.beginPath(); ctx.arc(s*0.5, s*0.18, s*0.065, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#d4997a";
    ctx.beginPath(); ctx.ellipse(s*0.54, s*0.19, s*0.03, s*0.022, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#c4a060";
    ctx.fillRect(s*0.47, s*0.1, s*0.018, s*0.055);
    ctx.fillRect(s*0.51, s*0.1, s*0.018, s*0.055);
    ctx.fillStyle = "#f5f0e8";
    [0.08, 0.18, 0.32, 0.4].forEach(function(lx) {
      ctx.fillRect(s*lx, s*0.33, s*0.04, s*0.13);
    });
    ctx.fillStyle = "#2a2320";
    [0.08, 0.18, 0.32, 0.4].forEach(function(lx) {
      ctx.fillRect(s*lx, s*0.44, s*0.04, s*0.03);
    });
    ctx.restore();
  }

  // Pre-render icon canvases
  var sectionIds = ["zacatky", "praha", "freelancing", "stavba", "biovavrinec", "navrat", "ai-era", "zaver"];
  chapters.forEach(function (ch, i) {
    var id = ch.id || sectionIds[i] || "";
    if (iconFns[id]) {
      iconCanvases[id] = createIconCanvas(id);
    }
  });

  /* ── State ─────────────────────────────────────── */
  var lastSectionIdx = -1;
  var bounceTime = 99;
  var bouncing = false;
  var animTime = 0;
  var isRunning = true;
  var prevTime = 0;
  var renderedCarPose = {
    x: 0,
    y: 0,
    rotation: 0
  };
  var freeDriveState = {
    mode: "standard",
    patternIndex: -1,
    patternTime: 0,
    entryProgress: 0,
    entryFromX: 0,
    entryFromY: 0,
    entryFromRotation: 0,
    returnProgress: 0,
    returnFromX: 0,
    returnFromY: 0,
    returnFromRotation: 0
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(start, end, t) {
    return start + (end - start) * t;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function lerpAngle(start, end, t) {
    var delta = ((end - start + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    return start + delta * t;
  }

  function getArcStrength(t) {
    var wave = Math.sin(t * Math.PI);
    return wave * wave;
  }

  function getActiveChapterIndex(positions, canvasCenter, storyRect) {
    var currentIdx = 0;
    var minDist = Infinity;

    if (storyRect.top >= -EDGE_SNAP_PX) {
      return 0;
    }

    if (storyRect.bottom <= canvasH + EDGE_SNAP_PX) {
      return positions.length - 1;
    }

    positions.forEach(function (y, i) {
      var d = Math.abs(y - canvasCenter);
      if (d < minDist) {
        minDist = d;
        currentIdx = i;
      }
    });

    return currentIdx;
  }

  function getScrollDrivenCarY(storyRect) {
    var startY = 40;
    var endY = canvasH - 40;
    var scrollSpan = Math.max(storyBody.offsetHeight - canvasH, 1);
    var traveled = clamp(-storyRect.top, 0, scrollSpan);
    var progress = traveled / scrollSpan;

    if (storyRect.top >= 0) {
      progress = 0;
    } else if (storyRect.bottom <= canvasH) {
      progress = 1;
    }

    return lerp(startY, endY, progress);
  }

  function getBaseCarYForScrollTop(scrollTop) {
    var startY = 40;
    var endY = window.innerHeight - 40;
    var storyTop = storyBody.getBoundingClientRect().top + window.scrollY;
    var scrollSpan = Math.max(storyBody.offsetHeight - window.innerHeight, 1);
    var traveled = clamp(scrollTop - storyTop, 0, scrollSpan);
    var progress = traveled / scrollSpan;

    if (scrollTop <= storyTop) {
      progress = 0;
    } else if (scrollTop >= storyTop + scrollSpan) {
      progress = 1;
    }

    return lerp(startY, endY, progress);
  }

  function getVisibleSectionScrollTop(section) {
    var sectionRect = section.getBoundingClientRect();
    var sectionTop = sectionRect.top + window.scrollY;
    var sectionBottom = sectionRect.bottom + window.scrollY;
    var topPadding = Math.max(88, window.innerHeight * 0.14);
    var bottomPadding = Math.max(40, window.innerHeight * 0.08);
    var docMaxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    var preferredTop = sectionTop - topPadding;
    var minScrollForBottom =
      sectionBottom - (window.innerHeight - bottomPadding);

    return clamp(Math.max(preferredTop, minScrollForBottom), 0, docMaxScroll);
  }

  function getAlignedScrollTopForSection(section) {
    if (!section) {
      return window.scrollY;
    }

    var sectionTop = section.getBoundingClientRect().top + window.scrollY;
    var storyTop = storyBody.getBoundingClientRect().top + window.scrollY;
    var storyBottom = storyTop + storyBody.offsetHeight;

    if (!storyBody.contains(section)) {
      return getVisibleSectionScrollTop(section);
    }

    var maxScroll = Math.max(0, Math.min(
      storyBottom - window.innerHeight,
      document.documentElement.scrollHeight - window.innerHeight
    ));
    var low = Math.max(0, Math.min(storyTop, maxScroll));
    var high = Math.max(low, maxScroll);

    for (var i = 0; i < 28; i++) {
      var mid = (low + high) / 2;
      var sectionY = sectionTop - mid;
      var carY = getBaseCarYForScrollTop(mid);

      if (sectionY > carY) {
        low = mid;
      } else {
        high = mid;
      }
    }

    return clamp((low + high) / 2, 0, maxScroll);
  }

  function getDetourPose(baseY, chapterMetrics) {
    var roadX = roadCenterX(baseY);
    var pose = {
      x: roadX,
      y: baseY
    };
    var bestMetric = null;
    var bestStrength = 0;
    var bestProgress = 0;

    chapterMetrics.forEach(function (metric) {
      var startY = metric.roadY - DETOUR_RANGE;
      var endY = metric.roadY + DETOUR_RANGE;

      if (baseY < startY || baseY > endY) {
        return;
      }

      var progress = clamp((baseY - startY) / (endY - startY), 0, 1);
      var strength = getArcStrength(progress);

      if (strength > bestStrength) {
        bestMetric = metric;
        bestStrength = strength;
        bestProgress = progress;
      }
    });

    if (!bestMetric) {
      return pose;
    }

    pose.x = roadX + (bestMetric.targetX - roadX) * bestStrength;
    pose.y = baseY - Math.sin(bestProgress * Math.PI * 2) * bestMetric.detourLift * bestStrength;
    return pose;
  }

  function getStandardCarPose(storyRect, chapterMetrics, bounceX, bounceRot, idleWobble) {
    var baseCarY = getScrollDrivenCarY(storyRect);
    var carPose = getDetourPose(baseCarY, chapterMetrics);

    return {
      x: carPose.x + idleWobble + bounceX,
      y: carPose.y,
      rotation: bounceRot
    };
  }

  function getViewportPose(localPose) {
    var canvasRect = canvas.getBoundingClientRect();

    return {
      x: canvasRect.left + localPose.x,
      y: canvasRect.top + localPose.y,
      rotation: localPose.rotation
    };
  }

  function startFreeDrive() {
    freeDriveState.mode = "free";
    freeDriveState.patternIndex = (freeDriveState.patternIndex + 1) % 3;
    freeDriveState.patternTime = 0;
    freeDriveState.entryProgress = 0;
    freeDriveState.entryFromX = renderedCarPose.x;
    freeDriveState.entryFromY = renderedCarPose.y;
    freeDriveState.entryFromRotation = renderedCarPose.rotation;
    freeDriveState.returnProgress = 0;
  }

  function stopFreeDrive() {
    if (freeDriveState.mode !== "free") {
      return;
    }

    freeDriveState.mode = "returning";
    freeDriveState.returnProgress = 0;
    freeDriveState.returnFromX = freeDriveState.x;
    freeDriveState.returnFromY = freeDriveState.y;
    freeDriveState.returnFromRotation = freeDriveState.rotation;
  }

  function getFreeDriveBasePose(patternIndex, time) {
    var centerX = overlayW / 2;
    var centerY = overlayH / 2;
    var ampX = Math.max(180, overlayW * 0.42);
    var ampY = Math.max(110, overlayH * 0.24);
    var pose = {
      x: centerX,
      y: centerY
    };

    if (patternIndex === 0) {
      pose.x = centerX + Math.sin(time * 0.9) * ampX;
      pose.y = centerY + Math.sin(time * 1.8) * ampY * 0.62;
    } else if (patternIndex === 1) {
      pose.x = centerX + Math.cos(time * 0.72) * ampX * 0.94;
      pose.y = centerY + Math.sin(time * 1.14) * ampY * 0.8 + Math.cos(time * 2.28) * ampY * 0.2;
    } else {
      pose.x = FREE_DRIVE_MARGIN + (overlayW - FREE_DRIVE_MARGIN * 2) * ((Math.sin(time * 0.58) + 1) * 0.5);
      pose.y = centerY + Math.sin(time * 2.4) * ampY * 0.46 + Math.cos(time * 0.92) * ampY * 0.28;
    }

    pose.x = clamp(pose.x, FREE_DRIVE_MARGIN, overlayW - FREE_DRIVE_MARGIN);
    pose.y = clamp(pose.y, FREE_DRIVE_MARGIN, overlayH - FREE_DRIVE_MARGIN);
    return pose;
  }

  function getFreeDrivePatternPose(patternIndex, time) {
    var pose = getFreeDriveBasePose(patternIndex, time);
    var nextPose = getFreeDriveBasePose(patternIndex, time + 0.018);

    pose.rotation = Math.atan2(nextPose.y - pose.y, nextPose.x - pose.x);
    return pose;
  }

  function getCarPose(standardPose, dt) {
    if (freeDriveState.mode === "free") {
      freeDriveState.patternTime += dt * FREE_DRIVE_TIME_SCALE;
      var patternPose = getFreeDrivePatternPose(freeDriveState.patternIndex, freeDriveState.patternTime);

      if (freeDriveState.entryProgress < 1) {
        var entryBlend = easeOutCubic(freeDriveState.entryProgress);
        patternPose = {
          x: lerp(freeDriveState.entryFromX, patternPose.x, entryBlend),
          y: lerp(freeDriveState.entryFromY, patternPose.y, entryBlend),
          rotation: lerpAngle(freeDriveState.entryFromRotation, patternPose.rotation, entryBlend)
        };

        freeDriveState.entryProgress = clamp(
          freeDriveState.entryProgress + dt * FREE_DRIVE_ENTRY_RATE,
          0,
          1
        );
      }

      freeDriveState.x = patternPose.x;
      freeDriveState.y = patternPose.y;
      freeDriveState.rotation = patternPose.rotation;
      return patternPose;
    }

    if (freeDriveState.mode === "returning") {
      freeDriveState.returnProgress = clamp(
        freeDriveState.returnProgress + dt * FREE_DRIVE_RETURN_RATE,
        0,
        1
      );

      var blend = easeOutCubic(freeDriveState.returnProgress);
      var returningPose = {
        x: lerp(freeDriveState.returnFromX, standardPose.x, blend),
        y: lerp(freeDriveState.returnFromY, standardPose.y, blend),
        rotation: lerpAngle(freeDriveState.returnFromRotation, standardPose.rotation, blend)
      };

      if (freeDriveState.returnProgress >= 1) {
        freeDriveState.mode = "standard";
      }

      return returningPose;
    }

    return standardPose;
  }

  function isPointOnCar(clientX, clientY) {
    var dx = (clientX - renderedCarPose.x) / (CAR_HIT_HALF_W * CAR_SCALE);
    var dy = (clientY - renderedCarPose.y) / (CAR_HIT_HALF_H * CAR_SCALE);

    return dx * dx + dy * dy <= 1.2;
  }

  function handleDocumentClick(event) {
    if (!isPointOnCar(event.clientX, event.clientY)) {
      return;
    }

    event.preventDefault();
    startFreeDrive();
  }

  function handleScrollDuringFreeDrive() {
    stopFreeDrive();
  }

  /* ── Main draw ─────────────────────────────────── */
  function draw(time) {
    if (!isRunning) return;
    requestAnimationFrame(draw);

    var dt = Math.min((time - prevTime) / 1000, 0.05);
    prevTime = time;
    animTime += dt;

    ctx.clearRect(0, 0, CANVAS_W, canvasH);
    overlayCtx.clearRect(0, 0, overlayW, overlayH);

    var chapterMetrics = getChapterMetrics();
    var positions = chapterMetrics.map(function (metric) {
      return metric.roadY;
    });
    var storyRect = storyBody.getBoundingClientRect();

    // Draw wavy road
    drawRoad();

    // Draw animated center dashes
    drawDashes();

    // Find active section with explicit snap to the first/last milestone near the edges.
    var canvasCenter = canvasH / 2;
    var currentIdx = getActiveChapterIndex(positions, canvasCenter, storyRect);

    // Draw milestone dots on road
    drawMilestones(positions, currentIdx);

    // Bounce on section change
    if (currentIdx !== lastSectionIdx && lastSectionIdx >= 0) {
      bouncing = true;
      bounceTime = 0;
    }
    lastSectionIdx = currentIdx;

    var bounceX = 0;
    var bounceRot = 0;
    if (bouncing) {
      bounceTime += dt;
      var decay = Math.exp(-bounceTime * 5);
      bounceX = Math.sin(bounceTime * 16) * BOUNCE_AMP * decay;
      bounceRot = Math.sin(bounceTime * 16) * 0.1 * decay;
      if (decay < 0.005) { bouncing = false; }
    }

    var idleWobble = Math.sin(animTime * 2.5) * 0.3;

    // Car follows the road progress and briefly detours into the active section area.
    var standardLocalPose = getStandardCarPose(
      storyRect,
      chapterMetrics,
      bounceX,
      bounceRot,
      idleWobble
    );
    var standardViewportPose = getViewportPose(standardLocalPose);
    var carPose = getCarPose(standardViewportPose, dt);

    renderedCarPose.x = carPose.x;
    renderedCarPose.y = carPose.y;
    renderedCarPose.rotation = carPose.rotation;

    if (freeDriveState.mode === "standard") {
      drawCar(ctx, standardLocalPose.x, standardLocalPose.y, standardLocalPose.rotation);
    } else {
      drawCar(overlayCtx, carPose.x, carPose.y, carPose.rotation);
    }

    // Draw icons at section positions
    chapters.forEach(function (ch, i) {
      var id = ch.id || sectionIds[i] || "";
      var iconCanvas = iconCanvases[id];
      if (!iconCanvas) return;

      var y = positions[i];
      if (y < -ICON_PX || y > canvasH + ICON_PX) return;

      var isCurrent = i === currentIdx;
      var dist = Math.abs(y - canvasCenter);
      var proximity = Math.max(0, 1 - dist / (canvasH * 0.4));

      ctx.save();
      ctx.globalAlpha = isCurrent ? 0.95 : (0.25 + proximity * 0.3);

      var scale = ICON_PX / 96;
      if (isCurrent) {
        scale *= 1 + Math.sin(animTime * 3 + i) * 0.05;
      }

      var floatX = isCurrent ? Math.sin(animTime * 1.5 + i * 2) * 3 : 0;

      // Icon to the right of road, following the curve
      var roadRight = roadCenterX(y) + ROAD_W / 2;
      var iconX = roadRight + 5 + floatX;
      var iconY = y;

      ctx.translate(iconX + ICON_PX * scale / 2, iconY + ICON_PX * scale / 2);

      if (id === "biovavrinec" && isCurrent) {
        ctx.rotate(Math.sin(animTime * 4) * 0.04);
      }

      ctx.drawImage(iconCanvas, -ICON_PX * scale / 2, -ICON_PX * scale / 2, ICON_PX * scale, ICON_PX * scale);
      ctx.restore();
    });

    // Fade top and bottom edges
    var fadeH = 60;
    ctx.save();
    var fadeTop = ctx.createLinearGradient(0, 0, 0, fadeH);
    fadeTop.addColorStop(0, "rgba(243, 239, 233, 1)");
    fadeTop.addColorStop(1, "rgba(243, 239, 233, 0)");
    ctx.fillStyle = fadeTop;
    ctx.fillRect(0, 0, CANVAS_W, fadeH);

    var fadeBot = ctx.createLinearGradient(0, canvasH - fadeH, 0, canvasH);
    fadeBot.addColorStop(0, "rgba(243, 239, 233, 0)");
    fadeBot.addColorStop(1, "rgba(243, 239, 233, 1)");
    ctx.fillStyle = fadeBot;
    ctx.fillRect(0, canvasH - fadeH, CANVAS_W, fadeH);
    ctx.restore();
  }

  /* ── Lifecycle ─────────────────────────────────── */
  window.storyJourney = window.storyJourney || {};
  window.storyJourney.getAlignedScrollTopForSection = getAlignedScrollTopForSection;
  document.addEventListener("click", handleDocumentClick);
  window.addEventListener("scroll", handleScrollDuringFreeDrive, { passive: true });
  window.addEventListener("resize", resizeCanvas);

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      isRunning = false;
    } else {
      isRunning = true;
      prevTime = performance.now();
      requestAnimationFrame(draw);
    }
  });

  prevTime = performance.now();
  requestAnimationFrame(draw);
})();
