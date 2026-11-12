;redcode-icws
;name Sturm und Drang
;author Giovanni Ciraolo e Luca Pancani
;assert CORESIZE==8192

        dat     #0
        dat     #0
        dat     #0
        dat     #0
        dat     #0
        dat     #0
        dat     #0
        dat     #0
        dat     #0
        dat     #0
        dat     #0
        dat     #0
        dat     #0
        dat     #0
        dat     #0
        dat     #0

p       dat     #2064
q       dat     #-2070
start   add     #16,p
        sub     #11,q
        cmp     @p,@q
        jmp     b
contr   jmn     start,p
a       add     #1,bomb
        mov     bomb,@bomb
        mov     tnt,<tnt
        jmp     a
bomb    dat     #6
tnt     dat     #-5
b       sub     #4,p
        add     #4,q
ba      mov     ddt,@p
        mov     ddt,@q
        add     #2,p
        sub     #2,q
        djn     ba,t
        add     #10,t
        jmp     contr
ddt     spl     0
t       dat     #10

        end     start

