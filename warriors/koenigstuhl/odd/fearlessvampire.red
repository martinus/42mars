;redcode-94
;name The Fearless Vampire
;author Christian Schmidt
;strategy vamp/scan hybrid
;strategy Halloween Core War Tournament 2014
;assert 1

        trap    EQU     6941
        vSTEP   EQU     4691
        vTIME   EQU     73

gate    dat     trap,                   0
fang    jmp     gate+trap,              0
loop    mov.i   inc,                    } gate
        add.f   inc,                    fang
        mov.i   fang,                   @ fang
        jmz.f   loop,                   * fang
ptr     mov.a   fang,                   gate
        djn.b   loop,                   # vTIME
inc     spl     # vSTEP,                # -vSTEP
clear   mov     bomb,                   > loop
        djn.f   -1,                     > loop
bomb    dat     < 2667,                 13


       for    8
       dat    0     ,  0
       rof

tDecoy    equ    gate+1582

tStart    mov    <tDecoy+0,{tDecoy+2
         mov    <tDecoy+3,{tDecoy+5
         mov    <tDecoy+6,{tDecoy+8
         mov    <tDecoy+10,{tDecoy+12
         djn.f  loop ,<tDecoy+14

end tStart
