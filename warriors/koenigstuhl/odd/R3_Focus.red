;redcode
;name Focus CGM
;author inversed
;strategy Clear-directing scan
;strategy Corewar Global Masters 2022 round 3 entry
;assert (CORESIZE==8000)

org     setup

bptr    mov       ptr   ,   #-8
wipe    mov       bomb  ,   > bptr
scan    add     #-8     ,     ptr
ptr     jmz.f     wipe  ,     0
        jmn       bptr  ,   * bptr
bomb    spl       0     ,     0
dclr    mov       kill  ,   > bptr
        djn.f     dclr  ,   > bptr
        dat       0     ,     0
kill    dat       scan  ,     8
setup   mul.ba    kill  ,   * kill
        mul.ab  * kill  ,   @ dclr
        djn.a   * kill  ,   * kill