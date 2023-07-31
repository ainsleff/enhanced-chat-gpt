import { useGetLeaderboardQuery } from '@librechat/data-provider';
import React, { useState, useEffect, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react'; // the AG Grid React Component

import 'ag-grid-community/styles/ag-grid.css'; // Core grid CSS, always needed
import 'ag-grid-community/styles/ag-theme-alpine.css'; // Optional theme CSS
import GoldMedal from '../svg/GoldMedal';
import SilverMedal from '../svg/SilverMedal';
import BronzeMedal from '../svg/BronzeMedal';

function placeCellRenderer(place) {
  switch (place) {
    default: return place + 1

    case 0: return <GoldMedal />

    case 1: return <SilverMedal />

    case 2: return <BronzeMedal />
  }
}

function userCellRenderer(user) {
  const { name, username } = user;
  const icon =
      <img
        className="rounded-sm"
        style={{ width: 30, height: 30 }}
        src={`https://api.dicebear.com/6.x/initials/svg?seed=${name}&fontFamily=Verdana&fontSize=36`}
        alt="avatar"
      />
  return(<div className="relative flex items-center justify-left gap-2">
    {icon}
    {username}
  </div>);
}

export default function Leaderboard() {
  const getLeaderboardQuery = useGetLeaderboardQuery();

  const [rowData, setRowData] = useState(); // Set rowData to Array of Objects, one Object per Row

  // Each Column Definition results in one Column.
  const [columnDefs, setColumnDefs] = useState([ // eslint-disable-line
    {
      field: '名次',
      cellRenderer: params => <div className="relative flex items-center justify-left">
        {placeCellRenderer(params.value)}
      </div>
    },
    {
      field: '用户',
      cellRenderer: params => userCellRenderer(params.value)
    },
    { field: '邀请人数' }
  ]);

  // DefaultColDef sets props common to all Columns
  const defaultColDef = useMemo( ()=> ({
    sortable: true
  }));

  useEffect(() => {
    if (getLeaderboardQuery.isSuccess) {
      let userList = [];
      for (let i = 0; i < getLeaderboardQuery.data.length; i++) {
        const name = getLeaderboardQuery.data[i].name;
        const username = getLeaderboardQuery.data[i].username;
        const numOfReferrals = getLeaderboardQuery.data[i].numOfReferrals;
        userList.push({
          '名次': i,
          '用户': { name, username },
          '邀请人数': numOfReferrals
        });
      }

      setRowData(userList);
    }
  }, [getLeaderboardQuery.isSuccess, getLeaderboardQuery.data]);

  return (
    <div className="flex h-full flex-col items-center overflow-y-auto pt-0 text-sm dark:bg-gray-800">
      <h1
        id="landing-title"
        className="mb-5 ml-auto mr-auto mt-3 flex items-center justify-center gap-2 text-center text-4xl font-semibold sm:mb-8 md:mt-[5vh]"
      >
        邀请排行榜
      </h1>
      <div className="w-full px-6 text-gray-800 dark:text-gray-100 md:flex md:max-w-2xl md:flex-col lg:max-w-3xl">
        <div className='grid grid-col justify-center'>
          {/* On div wrapping Grid a) specify theme CSS Class Class and b) sets Grid size */}
          <div className="ag-theme-alpine" style={{ width: 600, height: 500 }}>
            <AgGridReact
              rowData={rowData} // Row Data for Rows

              columnDefs={columnDefs} // Column Defs for Columns
              defaultColDef={defaultColDef} // Default Column Properties

              animateRows={true} // Optional - set to 'true' to have rows animate when sorted
            />
          </div>
        </div>
      </div>
    </div>
  );
}