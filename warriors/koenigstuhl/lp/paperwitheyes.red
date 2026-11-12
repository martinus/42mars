;redcode-lp
;author inversed
;name Paper With Eyes
;strategy Scanning paper
;assert (CORESIZE==8000) && (MAXPROCESSES==8)

len     equ     16
inc     equ     1727
zofs    equ     2454
color   equ     500

org     loop

from    mov     #len,   #len
scan    add.a   #inc,   to
        jmz.f   scan,   *to
loop    mov     <from,  {to
        jmn     loop,   from
        spl     from,   {color
to      jmz     zofs,   *0

