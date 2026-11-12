;redcode-tiny
;name Smartliner
;author Christian Schmidt
;strategy stone, clear
;assert 1
;optimax stn

sOff    equ     448
sOff1   equ     703
s1      equ     620
s2      equ     145

pGo     add.f inc, bomb
bomb    mov   }sOff, sOff1
        jmz   -2,   {bomb
        mov.x bomb, bomb

inc     spl   #s1,   <s2
        mov   @bptr, >bomb
        mov   @bptr, >bomb
        mov   @bptr, >bomb
bptr    djn.f -2,    {clr

        dat   #-5,  clr-bomb
clr     spl   #-5,  clr+1-bomb
        dat   {1,    1

        end   pGo
