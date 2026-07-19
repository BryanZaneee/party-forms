// <paper-shader> — mounts a Paper Shaders (open source, zero-dependency) Dithering canvas.
// Attributes: color-back, color-front (hex), shape (simplex|warp|dots|wave|ripple|swirl|sphere),
// type (random|2x2|4x4|8x8), px-size, speed.
// Paper Shaders dithering canvas; fallback gradient tinted to accent.
// Import client-side only.
(function () {
  if (customElements.get("paper-shader")) return;
  const SHAPES = { simplex: 1, warp: 2, dots: 3, wave: 4, ripple: 5, swirl: 6, sphere: 7 };
  const TYPES = { random: 1, "2x2": 2, "4x4": 3, "8x8": 4 };
  class PaperShader extends HTMLElement {
    static observedAttributes = ["speed", "color-front", "color-back"];
    async connectedCallback() {
      this.style.display = "block";
      if (!this.style.position) this.style.position = "absolute";
      this._fallback();
      try {
        const m = await import(/* webpackIgnore: true */ "https://esm.sh/@paper-design/shaders");
        this._m = m;
        if (!this.isConnected) return;
        const back = this.getAttribute("color-back") || "#070d1a";
        const front = this.getAttribute("color-front") || "#e11d74";
        const uniforms = {
          u_colorBack: m.getShaderColorFromString(back),
          u_colorFront: m.getShaderColorFromString(front),
          u_shape: SHAPES[this.getAttribute("shape") || "simplex"] || 1,
          u_type: TYPES[this.getAttribute("type") || "8x8"] || 4,
          u_pxSize: parseFloat(this.getAttribute("px-size") || "2.5"),
          u_fit: 2,
          u_scale: 1,
          u_rotation: 0,
          u_originX: 0.5,
          u_originY: 0.5,
          u_offsetX: 0,
          u_offsetY: 0,
          u_worldWidth: 0,
          u_worldHeight: 0,
        };
        this._mount = new m.ShaderMount(this, m.ditheringFragmentShader, uniforms, undefined, this._speed());
        this.style.background = "none";
      } catch {
        /* fallback gradient already applied */
      }
    }
    _speed() {
      return parseFloat(this.getAttribute("speed") || "0.4");
    }
    _fallback() {
      this.style.background = "linear-gradient(115deg,#070d1a 0%,#1c1030 45%,#e11d74 90%,#ff6aa9 120%)";
    }
    attributeChangedCallback(name, oldV, newV) {
      if (!this._mount) return;
      if (name === "speed") this._mount.setSpeed(this._speed());
      if (name === "color-front" && newV) this._mount.setUniforms({ u_colorFront: this._m.getShaderColorFromString(newV) });
      if (name === "color-back" && newV) this._mount.setUniforms({ u_colorBack: this._m.getShaderColorFromString(newV) });
    }
    disconnectedCallback() {
      try {
        if (this._mount) this._mount.dispose();
      } catch {
        /* already gone */
      }
      this._mount = null;
    }
  }
  customElements.define("paper-shader", PaperShader);
})();

export {}; // make this side-effect file a module for TS dynamic import()
