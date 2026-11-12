;redcode-94nop
;name loopy
;author John Metcalf
;stategy single process paper
;assert 1

paper   mov    #dest+9,   #0
        add.a  #7847,      dest
copy    mov    <paper,    {dest
        jmn    copy,      paper
        spl    paper
dest    jmz    4932,      *0 

