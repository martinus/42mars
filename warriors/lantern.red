;redcode-94
;name Lantern
;author 42mars sample
;strategy Stone: drops 800 DAT bombs with a step of 3359, then wipes the
;strategy rest of the core with a forward DAT clear that stops before itself.
;assert CORESIZE == 8000
step    equ     3359
bombs   equ     800

        org     start
start   add.ab  #step,  target
        mov.i   bomb,   @target
        djn.b   start,  #bombs
        mov.ab  #1,     target
clear   mov.i   bomb,   >target
        djn.b   clear,  #CORESIZE-9
        jmp     0
bomb    dat     #0,     #0
target  dat     #0,     #0
        end
