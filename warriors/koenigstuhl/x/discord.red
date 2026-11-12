;redcode-94x
;name Discord
;author John Metcalf
;strategy scanner
;assert CORESIZE==55440

        st    equ 8286

        fi    equ scan+st
        gap   equ 8
        count equ 8

        org    scan+1

scan    sub    inc,      ptrs
ptrs    sne    fi-gap,   fi
        sub    inc,      ptrs
        seq    *ptrs,    @ptrs
        slt    #dbmb+16-ptrs, ptrs
        djn.f  scan,     <-10000

wptr    mov.b  ptrs,     #0
        add    #count,   c

wipe    mov    *1,       <wptr
        mov    inc,      <wptr
c       djn    wipe,     #0

        jmz    scan,     scan-1

inc     spl    #-st,     -st
clear   mov    dbmb,     >wipe+1
        djn.f  clear,    {wipe+1
dbmb    dat    1,        9

        end

