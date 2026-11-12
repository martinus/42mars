;redcode-nano
;author inversed
;name in the passing rain
;strategy Hand-coded paper
;assert CORESIZE==80

ofs    equ    66
aval   equ    26
bval   equ    43
cval   equ    34

silk   spl    #       0  ,  <     ofs
       mov    }    silk  ,  >    silk
       spl     silk+ofs  ,  >    cval
       mov    >    aval  ,       bval
       djn.f  <       0  ,  >       0

