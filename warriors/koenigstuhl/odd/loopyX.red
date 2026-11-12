;redcode-94nop
;name LoopyX
;author John Metcalf
;strategy looping paper
;assert CORESIZE==8000

paper   mov    #49,      #0
copy    mov    <paper,   {dest
        jmn    copy,     paper
        spl    >paper,   {-1277
dest    jmz    5620,     *0

