;redcode-nano
;name the thorn
;author hwm
;assert (CORESIZE==80)

    step  equ -5
    first equ wipe+11
    second equ 20

scan:sub   #step,    wipe
wipe:jmz.f scan,     first
     mov.i # 25,     >wipe
     djn.f wipe,     <75
     jmz.f wipe,     >second
     end   wipe
