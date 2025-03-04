#include <glad/glad.h>
#include <GLFW/glfw3.h>
#include <iostream>
#include <chrono>

float lastFrameTime = 0, deltaTime = 0, timeAccumulator[2] = { 0.0f, 0.0f }, deltamultiplier = 100.0f, temp = 1.0f;
bool toggle = true;

// Vertex Shader source
const char* vertexShaderSource = R"(
attribute vec3 p;
uniform float zoom;
void main(void) {
    gl_Position = vec4(p, zoom);
})";

// Fragment Shader source
const char* fragmentShaderSource = R"(
precision highp float;
uniform vec2 resolution;
uniform float time;
uniform float scale;
void main(void) {
    vec2 p = abs(gl_FragCoord.xy - resolution / 2.0);
    float f = time * scale;
    float n = (p.x + p.y) / 2.0 + mix(f, -f, step(length(resolution) / 5.5, length(p)));
    gl_FragColor = vec4(vec3(sin(n / 5.0 / scale) * 8.0), 1.0);
})";

// Resize callback function
void framebuffer_size_callback(GLFWwindow* window, int width, int height) { glViewport(0, 0, width, height); }

int main() {
    if (!glfwInit()) { std::cerr << "Failed to initialize GLFW" << std::endl; return -1; }

    GLFWwindow* window = glfwCreateWindow(1920, 1080, "OpenGL Weird Shader", NULL, NULL);

    if (!window) { std::cerr << "Failed to create GLFW window" << std::endl; glfwTerminate(); return -1; }
    glfwMakeContextCurrent(window);

    if (!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress)) { std::cerr << "Failed to initialize GLAD" << std::endl; return -1; }

    glfwSetFramebufferSizeCallback(window, framebuffer_size_callback);

    GLuint vertexShader = glCreateShader(GL_VERTEX_SHADER);
    glShaderSource(vertexShader, 1, &vertexShaderSource, NULL);
    glCompileShader(vertexShader);

    int success;
    char infoLog[512];
    glGetShaderiv(vertexShader, GL_COMPILE_STATUS, &success);
    if (!success) { glGetShaderInfoLog(vertexShader, 512, NULL, infoLog); std::cerr << "Vertex Shader Compilation Error:\n" << infoLog << std::endl; }

    GLuint fragmentShader = glCreateShader(GL_FRAGMENT_SHADER);
    glShaderSource(fragmentShader, 1, &fragmentShaderSource, NULL);
    glCompileShader(fragmentShader);

    glGetShaderiv(fragmentShader, GL_COMPILE_STATUS, &success);

    if (!success) { glGetShaderInfoLog(fragmentShader, 512, NULL, infoLog); std::cerr << "Fragment Shader Compilation Error:\n" << infoLog << std::endl; }

    GLuint shaderProgram = glCreateProgram(); glAttachShader(shaderProgram, vertexShader); glAttachShader(shaderProgram, fragmentShader); glLinkProgram(shaderProgram);

    glGetProgramiv(shaderProgram, GL_LINK_STATUS, &success);
    if (!success) { glGetProgramInfoLog(shaderProgram, 512, NULL, infoLog); std::cerr << "Shader Program Linking Error:\n" << infoLog << std::endl; }

    glDeleteShader(vertexShader);
    glDeleteShader(fragmentShader);

    GLfloat vertices[] = {
        -1.0f, -1.0f, 0.0f,
         1.0f, -1.0f, 0.0f,
        -1.0f,  1.0f, 0.0f,
         1.0f,  1.0f, 0.0f
    };

    GLuint VAO, VBO;
    glGenVertexArrays(1, &VAO);
    glGenBuffers(1, &VBO);

    glBindVertexArray(VAO);
    glBindBuffer(GL_ARRAY_BUFFER, VBO);
    glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);
    glEnableVertexAttribArray(0);

	glfwSwapInterval(1); // vsync
    while (!glfwWindowShouldClose(window)) {

        float currentFrameTime = static_cast<float>(glfwGetTime());
        deltaTime = currentFrameTime - lastFrameTime;
		lastFrameTime = currentFrameTime;

            timeAccumulator[0] += deltaTime;
			timeAccumulator[1] += deltaTime;

            if (timeAccumulator[0] >= 0.016f) { //run if after 1 second (1hz)
                if (glfwGetMouseButton(window, GLFW_MOUSE_BUTTON_5) == GLFW_PRESS) { deltamultiplier += 1.0f; } // zoom out
                if (glfwGetMouseButton(window, GLFW_MOUSE_BUTTON_4) == GLFW_PRESS) { deltamultiplier -= 1.0f; } // zoom in
                if (glfwGetKey(window, GLFW_KEY_SPACE) == GLFW_PRESS) { deltamultiplier = 100.0f; } // zoom in
                switch (toggle) {
                case true:
                    if (temp <= 1.0f) {
                        temp -= 0.005f;
                        //	std::cout << temp << std::endl;
                    }
                    if (temp <= -1.0f) {
                        temp = 1.0f;
                    }
                    break;
                case false:
                    temp = 1.0f;
                    break;
                }

                    timeAccumulator[0] = 0.0f; //reset time
            } // zoom in
        if (timeAccumulator[1] >= 0.16f) { //run if after 1 second (1hz)
            if (glfwGetKey(window, GLFW_KEY_LEFT_SHIFT) == GLFW_PRESS) { switch (toggle) { case true: toggle = false; break; case false: toggle = true; break; } std::cout << "Toggle: " << toggle << std::endl; }
            timeAccumulator[1] = 0.0f; //reset time

        } // zoom in
        glClear(GL_COLOR_BUFFER_BIT);
        glUseProgram(shaderProgram);

        int width, height;
        glfwGetFramebufferSize(window, &width, &height);

        glUniform2f(glGetUniformLocation(shaderProgram, "resolution"), (float)width, (float)height);
        glUniform1f(glGetUniformLocation(shaderProgram, "time"), currentFrameTime * deltamultiplier);
        glUniform1f(glGetUniformLocation(shaderProgram, "scale"), temp);
        glUniform1f(glGetUniformLocation(shaderProgram, "zoom"), 1.0f);

        glBindVertexArray(VAO);
        glDrawArrays(GL_TRIANGLE_STRIP, 0, 4);

        glfwSwapBuffers(window);
        glfwPollEvents();
    }

    glDeleteVertexArrays(1, &VAO);
    glDeleteBuffers(1, &VBO);
    glDeleteProgram(shaderProgram);
    glfwTerminate();
    return 0;
}