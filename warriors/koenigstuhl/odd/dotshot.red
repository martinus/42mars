;redcode-94lp
;name .Shot
;author Christian Schmidt
;strategy oneshot -> jjd clear
;assert CORESIZE==8000 
;       MAXPROCESSES==8

gate    equ     (bye-3)
step    equ     8
time    equ     2076
init    equ     (star+4+160)

loop    add.a   #step,  bye
star    jmz.f   loop,   *bye
        mov.ab  @star,  gate
        jmp     clr,    <gate

for     8
        dat     0,      0
rof

        dat     <gate,  {10
        jmp     #gate,  {11
bye     jmp     #init,  {11

for     4
        dat     0,      0
rof

clr     mov     @bmbp,  >gate
        mov     @bmbp,  >gate
bmbp    djn     clr,    {bye
        jmp     {0,     }0

        end     star
