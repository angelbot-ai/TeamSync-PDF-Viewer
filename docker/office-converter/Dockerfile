# High-Fidelity Office Document Conversion Service
# Based on Gotenberg 8 with Microsoft TrueType Fonts & ClearType Packages
FROM gotenberg/gotenberg:8

LABEL maintainer="AngelBot Ai <support@angelbot.ai>"
LABEL description="Headless LibreOffice conversion microservice with Microsoft font packages for TeamSync PDF Viewer"

USER root

# Install tools for extracting Microsoft Core TrueType fonts
RUN apt-get update && apt-get install -y --no-install-recommends \
    cabextract \
    xfonts-utils \
    fontconfig \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Microsoft TrueType core fonts (Arial, Times New Roman, Courier New, Verdana, etc.)
RUN echo "ttf-mscorefonts-installer msttcorefonts/accepted-mscorefonts-eula select true" | debconf-set-selections \
    && apt-get update \
    && apt-get install -y --no-install-recommends ttf-mscorefonts-installer \
    && rm -rf /var/lib/apt/lists/*

# Install Google Noto and Liberation fonts as metric-compatible fallbacks
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-noto-core \
    fonts-noto-cjk \
    fonts-liberation \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Refresh font cache
RUN fc-cache -f -v

# Switch back to the unprivileged gotenberg user for security
USER gotenberg

# Gotenberg listens on port 3000 inside the container
EXPOSE 3000
