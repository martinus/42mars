;redcode-94
;name D: StolenLPWarrior
;assert 1
;author Roy van Rijn
;strategy Some old scrap I found, I don't even know what warrior it is!

gate    equ     (bye-3)
step    equ     245
time    equ     2076
init    equ     (-1-time*step)

loop    add.a   #step,  bye
star    jmz.f   loop,   *bye
        mov.ab  @star,  gate
        jmp     clr,    <gate

for     10
        dat     0,      0
rof

        dat     <gate,  {10
        jmp     #gate,  {11
bye     jmp     #init,  {11
clr     mov     @bmbp,  >gate
        mov     @bmbp,  >gate
bmbp    djn     clr,    {bye
        jmp     {0,     }0

        end     star

