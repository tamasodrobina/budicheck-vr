import React, { useEffect, useRef } from 'react';

const VERTEX_SHADER = `
attribute vec2 a_position;
void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;

// High quality 2D noise
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

// Fractional Brownian Motion for smooth topographic contours
float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 4; ++i) {
        v += a * noise(p);
        p = rot * p * 2.0 + vec2(12.5);
        a *= 0.5;
    }
    return v;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    
    // Slow, calming topographic wave drift
    float t = u_time * 0.035;
    
    // Smooth interactive mouse warp
    vec2 m = (u_mouse * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    float distToMouse = length(p - m);
    vec2 mouseWarp = (p - m) * exp(-distToMouse * 2.2) * 0.12;
    vec2 coords = (p + mouseWarp) * 1.5;
    
    // Compute multi-frequency topographic elevation
    float h1 = fbm(coords + vec2(t * 0.5, t * 0.35));
    float h2 = fbm(coords * 1.2 - vec2(t * 0.25, t * 0.4) + vec2(h1 * 0.8));
    float height = mix(h1, h2, 0.5);
    
    // Crisp mathematical contour lines (concentric topographic rings)
    float density = 24.0;
    float line = pow(max(0.0, sin(height * 3.14159265 * density)), 16.0);
    // Major index contours (every 4th line is subtly stronger)
    float majorLine = pow(max(0.0, sin(height * 3.14159265 * (density * 0.25))), 20.0);
    float totalLines = clamp(line * 0.75 + majorLine * 0.45, 0.0, 1.0);
    
    // Palette: Deep obsidian base + darker subtle tones (Cyan, Violet, Emerald)
    vec3 baseColor = vec3(0.02, 0.024, 0.035); // #050609 deep obsidian
    
    vec3 cyanLine = vec3(0.0, 0.65, 0.82);      // Darker neon cyan
    vec3 violetLine = vec3(0.50, 0.22, 0.88);   // Deep royal violet
    vec3 emeraldLine = vec3(0.06, 0.62, 0.45);  // Dark mint emerald
    
    // Dynamic color gradient following the elevation height
    vec3 lineColor = mix(cyanLine, violetLine, sin(height * 6.28 + t) * 0.5 + 0.5);
    lineColor = mix(lineColor, emeraldLine, cos(height * 4.0 - t * 0.5) * 0.5 + 0.5);
    
    // Ambient vignette darkening toward the edges
    float vignette = 1.0 - smoothstep(0.4, 1.45, length(uv - 0.5) * 1.3);
    
    // Combine base with glowing lines
    vec3 finalColor = baseColor + (lineColor * totalLines * 0.42 * vignette);
    
    // Subtle ambient elevation glow
    finalColor += lineColor * height * 0.03 * vignette;

    gl_FragColor = vec4(finalColor, 1.0);
}
`;

export default function TopographicBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    let animId;
    let startTime = performance.now();

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let targetMouseX = mouseX;
    let targetMouseY = mouseY;

    const handleMouseMove = (e) => {
      targetMouseX = e.clientX;
      targetMouseY = window.innerHeight - e.clientY; // Invert for WebGL coordinates
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    const handleResize = () => {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    if (gl) {
      const createShader = (type, source) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          console.error(gl.getShaderInfoLog(shader));
          gl.deleteShader(shader);
          return null;
        }
        return shader;
      };

      const vertShader = createShader(gl.VERTEX_SHADER, VERTEX_SHADER);
      const fragShader = createShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);

      if (vertShader && fragShader) {
        const program = gl.createProgram();
        gl.attachShader(program, vertShader);
        gl.attachShader(program, fragShader);
        gl.linkProgram(program);

        if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
          gl.useProgram(program);

          // Fullscreen Quad
          const positionBuffer = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
          gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
            gl.STATIC_DRAW
          );

          const posLoc = gl.getAttribLocation(program, 'a_position');
          gl.enableVertexAttribArray(posLoc);
          gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

          const resLoc = gl.getUniformLocation(program, 'u_resolution');
          const timeLoc = gl.getUniformLocation(program, 'u_time');
          const mouseLoc = gl.getUniformLocation(program, 'u_mouse');

          const render = (now) => {
            const time = (now - startTime) * 0.001;

            // Interpolate mouse smoothly
            mouseX += (targetMouseX - mouseX) * 0.06;
            mouseY += (targetMouseY - mouseY) * 0.06;

            gl.uniform2f(resLoc, canvas.width, canvas.height);
            gl.uniform1f(timeLoc, time);
            gl.uniform2f(mouseLoc, mouseX, mouseY);

            gl.drawArrays(gl.TRIANGLES, 0, 6);
            animId = requestAnimationFrame(render);
          };

          animId = requestAnimationFrame(render);
        }
      }
    } else {
      // 2D Canvas Fallback if WebGL is unavailable
      const ctx = canvas.getContext('2d');
      if (ctx) {
        let t = 0;
        const render2D = () => {
          t += 0.01;
          ctx.fillStyle = '#050609';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          ctx.strokeStyle = 'rgba(0, 242, 254, 0.22)';
          ctx.lineWidth = 1.5;

          const numLines = 20;
          for (let i = 0; i < numLines; i++) {
            ctx.beginPath();
            const yOffset = (canvas.height / numLines) * i;
            for (let x = 0; x <= canvas.width; x += 30) {
              const y = yOffset + Math.sin(x * 0.004 + t + i * 0.3) * 35;
              if (x === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.stroke();
          }
          animId = requestAnimationFrame(render2D);
        };
        render2D();
      }
    }

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <div className="topographic-bg-container">
      <canvas
        ref={canvasRef}
        className="topographic-bg-canvas"
      />
      <div className="topographic-bg-vignette" />
    </div>
  );
}
