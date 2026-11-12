;redcode-icws
;name Panca 1
;author Luca Pancani e Giovanni Ciraolo
;assert CORESIZE==8192

p       dat     #2068
start   spl     b
a       add     #16,p
        jmz     a,@p
        sub     #10,p
        mov     ad,@p
        mov     ac,<p
        mov     ab,<p
        mov     aa,<p
        spl     @p
        add     #600,p
        jmp     a
aa      add     #1,3
ab      mov     2,@2
ac      jmp     -2
ad      dat     #3
b       sub     #15,h
        jmz     b,@h
        add     #5,h
        mov     bc,@h
        mov     bb,<h
        mov     ba,<h
        spl     @h
        sub     #600,h
        jmp     b
ba      mov     2,<h
bb      jmp     -1
bc      dat     #-3
h       dat     #-2072

        end     start

