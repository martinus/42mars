;redcode
;name Black
;author Will 'Varfar'
;assert 1

        org     scan

scan    sne     >ptr,   >ptr
        jmz     scan,   >ptr
adjust  sne     @ptr,   tail
        jmz     adjust, <ptr
ptr
;break
follow  add     #162,   #MINDISTANCE
        jmn     follow, @follow
        add     #2722,  follow
        jmz     found,  @follow
bomb    mov     tail,   >follow
        jmp     bomb
;break
found   add     #80,    follow
        jmp     bomb
tail    end
