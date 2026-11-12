;redcode
;name Dragonfly '88
;author S.Fernandes
;strategy oneshot
;assert CORESIZE == 8000

gap     equ     -14
step    equ     -730

cleanup dat     <2667       ,    #cleanup-x

        add     #15         ,    ptr

clr     spl     0           ,    cleanup-x
        mov     @x          ,    <ptr
        mov     @x          ,    <ptr
        mov     @x          ,    <ptr
        djn     clr+1       ,    <-200

inc     dat     <step       ,    <step

loop    add     inc         ,    ptr
ptr     cmp     step+gap    ,    step
x       jmp     clr-1       ,    clr
        djn     loop        ,    @ptr

        end     ptr

