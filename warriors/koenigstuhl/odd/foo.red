;redcode-94x
;name foo
;assert 1
;author Joonas
;strategy one-shot

ptr     dat     38,     12
        dat     0,0
        dat     0,0
        dat     0,0
        dat     0,0
        dat     0,0
        dat     0,0
        dat     0,0
        dat     0,sca
        dat     0,0
        dat     0,0
        dat     0,0
bmb     dat     bot+1-ptr, mv
doit    mov     inc, bot
        mov.ab  #ptr-bot, bot
        mov.a   #bmb-bot, bot
sca     sub     inc, ptr
        sne     *ptr, @ptr
inc     jmp     @-10, >-10
mv      mov     bmb, }ptr
bot equ (mv+1)
end doit
