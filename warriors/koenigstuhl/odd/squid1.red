;redcode-odd
;name squid 1
;author will 'varfar' nods to John Metcalf
;strategy what strategy?
;strategy Origin of Storms, ashamedly
;assert 1
;       (CORESIZE==6000) && (MAXCYCLES==60000) && (MAXPROCESSES==6000)

        step  equ 17
        first equ 240
        dist  equ 2000
        time  equ 285

ptr:    sne   first,    first+dist
        add   db,       ptr
p:      mov   bomb,     }ptr
        mov   bomb,     >ptr
        djn   @p,       #time
;break
bomb:   spl   #1,       1
        mov   db,       >ptr
        djn.f -1,       >ptr
db:     dat   step-1,   step-1
        end
