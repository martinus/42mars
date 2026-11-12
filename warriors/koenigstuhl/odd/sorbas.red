;redcode
;name Sorbas
;author Sascha Zapf
;assert 1
;       CORESIZE==256

start   spl    1 , <-64
        spl    1 ,<-128
loop    mov.i  start-1, <start-8
        jmp    loop,    <start-8
