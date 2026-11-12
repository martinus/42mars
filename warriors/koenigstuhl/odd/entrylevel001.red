;redcode-94
;name Entry Level 0.0.1
;author Levi <levi@gis.net>
;strategy Imp Gate + Core Clear (stone:gate,clear)
;assert 1

        org     start
gate    nop     <gate,<gate
bomb    dat     13,42
start   spl     clear
keeper  jmp     keeper,<gate
        jmp     gate
clear   mov     bomb, bomb-1
        sub     #1,clear
        jmp     clear, <gate

