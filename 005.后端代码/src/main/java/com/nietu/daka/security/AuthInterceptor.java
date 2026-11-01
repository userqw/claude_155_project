package com.nietu.daka.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nietu.daka.common.Result;
import com.nietu.daka.mapper.AccountMapper;
import com.nietu.daka.common.ResultCode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * 鉴权拦截器：除白名单外都要带 token。
 *
 * <p>失败时直接写统一响应体，不抛到 DispatcherServlet，
 * 免得前端拿到一段 HTML 或空 body。
 */
@Component
public class AuthInterceptor implements HandlerInterceptor {

    private final JwtTokenProvider tokenProvider;
    private final JwtProperties properties;
    private final ObjectMapper objectMapper;
    private final AccountMapper accountMapper;

    public AuthInterceptor(JwtTokenProvider tokenProvider, JwtProperties properties,
                           ObjectMapper objectMapper, AccountMapper accountMapper) {
        this.tokenProvider = tokenProvider;
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.accountMapper = accountMapper;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws Exception {
        String header = request.getHeader(properties.getHeader());
        if (header == null || header.isBlank()) {
            return unauthorized(response, ResultCode.UNAUTHORIZED.message());
        }
        String prefix = properties.getPrefix();
        String token = header.startsWith(prefix) ? header.substring(prefix.length()).trim() : header.trim();
        String openid = tokenProvider.parse(token);
        if (openid == null) {
            return unauthorized(response, "登录已过期，请重新登录");
        }
        // 账号注销后 token 要立刻失效：JWT 里只有 openid，签名有效不代表账号还在
        if (accountMapper.selectById(openid) == null) {
            return unauthorized(response, "账号不存在或已注销，请重新登录");
        }
        AuthContext.set(openid);
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        AuthContext.clear();
    }

    private boolean unauthorized(HttpServletResponse response, String message) throws Exception {
        response.setStatus(HttpServletResponse.SC_OK);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write(objectMapper.writeValueAsString(Result.fail(ResultCode.UNAUTHORIZED, message)));
        return false;
    }
}
