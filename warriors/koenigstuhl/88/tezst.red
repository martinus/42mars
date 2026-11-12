;redcode
;name tezst
;author nandor sieben
;assert 1

clear   mov -4 , <0
start   add #3044 , dest
        mov dest , @dest      ;second hit
dest    jmp start , <dest     ;first hit
        end start

