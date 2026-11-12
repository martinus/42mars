;redcode-94x
;name fizGhost
;author Christian Schmidt
;strategy nearly invisible stone with invisible bombs
;strategy good against most scanner and oneshots ;-)
;assert 1

pStart  spl    #1,       1
        add.b  *1,       1
        mov.i  @1,       1
        jmp    -2,       788

        end     pStart

