;redcode-tiny
;name T-Scan
;author John Metcalf
;strategy Table Scan
;assert CORESIZE==800

scan    sne    *table-1,   @table-1
        djn.f  <0,         >0
        add.x  @scan,      }0

bptr    div.ab #bomb,      #11
bomb    spl    #400,       14
clear   mov    *bptr,      >scan
        mov    *bptr,      >scan
        djn.f  clear,      }bomb

        step  equ 60

        dat    table-1,    table-1+20
a       for    11
        spl    #table+(12-a)*step,<table+(12-a)*step+20
        rof

table   end